import { checkFinalClaims } from "./claim-check.js";
import { contextMetadata, buildInitialMessages } from "./prompt.js";
import { createId } from "./ids.js";
import { extractAssistantMessage, parseToolCalls, toolResultMessage } from "./tool-calls.js";
import { createLogger, serializeError } from "./logger.js";
import { createOpenAICompatibleProvider } from "./provider.js";
import { buildContextMessages, compactTransientMessages, maybeCompactMemory } from "./context-compactor.js";
import { createFileConversationMemoryStore, redactMemoryText } from "./memory-store.js";
import { TurnResourceManager } from "./resource-manager.js";
import { estimateMessagesTokens, normalizeContextOptions } from "./token-accounting.js";
import { createDefaultToolRegistry } from "../tools/registry.js";
import { ToolExecutionError } from "../tools/errors.js";

export async function runAgentTurn({
  message,
  conversationId = "",
  toolMode = "enabled",
  metadata = {},
  provider = createOpenAICompatibleProvider(),
  registry = createDefaultToolRegistry(),
  memoryStore = createFileConversationMemoryStore(),
  contextOptions = {},
  initialMessages,
  claimCheckEnabled = true,
  resourceManager,
  turnTimeoutMs = 30000,
  logger = createLogger(),
  maxProviderCalls = 6,
  maxToolCalls = 12
} = {}) {
  if (typeof message !== "string" || message.trim().length === 0) {
    throw new ToolExecutionError("message must be a non-empty string", {
      code: "VALIDATION_ERROR"
    });
  }

  const turnId = createId("turn");
  const traceId = createId("trace");
  const meta = contextMetadata({ toolMode });
  const normalizedContext = normalizeContextOptions(contextOptions);
  const manager = resourceManager || new TurnResourceManager({ timeoutMs: turnTimeoutMs });
  let memoryDebug;
  try {
    memoryDebug = await prepareMemoryDebug({
      conversationId,
      message,
      memoryStore,
      contextOptions: normalizedContext
    });
  } catch (error) {
    await manager.cleanup();
    throw error;
  }
  let messages = buildContextMessages({
    baseMessages: initialMessages || buildInitialMessages({ message }),
    memory: memoryDebug.memory
  });
  const tools = toolMode === "disabled" ? [] : registry.specs();
  const toolEvents = [];
  const debugMainAgent = {
    provider: provider.name,
    toolMode,
    input: { messages: snapshotMessages(messages) },
    providerCalls: [],
    toolCalls: []
  };
  const executedCalls = new Map();
  const attachedSurfaces = [];
  let providerCalls = 0;
  let toolCallCount = 0;

  logger.event("turn.start", { traceId, turnId, conversationId, metadata: safeMetadata(metadata), ...meta });

  try {
    while (providerCalls < maxProviderCalls) {
    providerCalls += 1;
    const providerSpanId = createId("span");
    logger.event("provider.request", {
      traceId,
      spanId: providerSpanId,
      turnId,
      providerName: provider.name,
      providerCall: providerCalls,
      toolsCount: tools.length,
      ...meta
    });

    let response;
    const providerRequest = toolMode === "disabled"
      ? { messages, signal: manager.signal }
      : { messages, tools, signal: manager.signal };
    const requestSnapshot = {
      messages: snapshotMessages(messages)
    };
    if (toolMode !== "disabled") {
      requestSnapshot.tools = snapshotTools(tools);
    }
    const providerRequestSnapshot = {
      providerCall: providerCalls,
      request: requestSnapshot
    };
    try {
      response = await provider.complete(providerRequest);
    } catch (error) {
      providerRequestSnapshot.error = serializeError(error);
      debugMainAgent.providerCalls.push(providerRequestSnapshot);
      logger.event("provider.error", {
        level: "error",
        traceId,
        spanId: providerSpanId,
        turnId,
        providerName: provider.name,
        error: serializeError(error),
        ...meta
      });
      throw new ToolExecutionError("provider request failed", {
        code: "PROVIDER_REQUEST_FAILED",
        cause: error
      });
    }

    logger.event("provider.response", {
      traceId,
      spanId: providerSpanId,
      turnId,
      providerName: provider.name,
      responseId: response?.id,
      ...meta
    });

    const assistantMessage = extractAssistantMessage(response);
    const calls = parseToolCalls(assistantMessage);
    providerRequestSnapshot.response = snapshotProviderResponse(response, assistantMessage, calls);
    debugMainAgent.providerCalls.push(providerRequestSnapshot);
    if (toolMode === "disabled" && calls.length > 0) {
      const blockedCalls = calls.map((call) => ({
        id: call.id,
        name: call.name,
        status: "blocked",
        code: "PROFILE_TOOL_CALL_BLOCKED"
      }));
      debugMainAgent.toolCalls.push(...blockedCalls);
      toolEvents.push(...blockedCalls);
      logger.event("tool.call.blocked", {
        level: "warn",
        traceId,
        turnId,
        code: "PROFILE_TOOL_CALL_BLOCKED",
        toolCallCount: calls.length,
        ...meta
      });
      const answer = assistantMessage.content || "이 프로필에서는 도구 호출이 비활성화되어 실행하지 않았습니다.";
      const persistedMemory = await persistTurnMemory({
        conversationId,
        memoryStore,
        memory: memoryDebug.memory,
        user: message,
        assistant: answer
      });
      const resources = await manager.cleanup();
      return {
        ok: true,
        turnId,
        traceId,
        answer,
        toolCalls: toolEvents,
        provider: {
          name: provider.name,
          responseId: response?.id
        },
        metadata: {
          ...meta,
          providerCalls,
          claimCheck: { passed: true, downgraded: false, answer },
          attachments: {
            surfaces: attachedSurfaces
          },
          context: contextDebug({
            messages,
            options: normalizedContext,
            memoryDebug,
            persistedMemory
          }),
          resources,
          debug: {
            mainAgent: {
              ...debugMainAgent,
              output: answer,
              rawOutput: assistantMessage.content || ""
            }
          }
        }
      };
    }
    if (calls.length === 0) {
      const answer = assistantMessage.content || "";
      const claimCheck = claimCheckEnabled
        ? checkFinalClaims(answer, toolEvents)
        : { passed: true, downgraded: false, answer };
      logger.event("final.claim_check", {
        traceId,
        turnId,
        passed: claimCheck.passed,
        downgraded: claimCheck.downgraded,
        toolEventCount: toolEvents.length,
        ...meta
      });
      logger.event("turn.complete", { traceId, turnId, providerCalls, toolCallCount, ...meta });
      const persistedMemory = await persistTurnMemory({
        conversationId,
        memoryStore,
        memory: memoryDebug.memory,
        user: message,
        assistant: claimCheck.answer
      });
      const resources = await manager.cleanup();
      return {
        ok: true,
        turnId,
        traceId,
        answer: claimCheck.answer,
        toolCalls: toolEvents,
        provider: {
          name: provider.name,
          responseId: response?.id
        },
        metadata: {
          ...meta,
          providerCalls,
          claimCheck,
          attachments: {
            surfaces: attachedSurfaces
          },
          context: contextDebug({
            messages,
            options: normalizedContext,
            memoryDebug,
            persistedMemory
          }),
          resources,
          debug: {
            mainAgent: {
              ...debugMainAgent,
              output: claimCheck.answer,
              rawOutput: answer
            }
          }
        }
      };
    }

    messages.push({
      role: "assistant",
      content: assistantMessage.content || "",
      tool_calls: assistantMessage.tool_calls
    });
    messages = compactMidTurnIfNeeded(messages, normalizedContext, memoryDebug);

    for (const call of calls) {
      if (toolCallCount >= maxToolCalls) {
        throw new ToolExecutionError("max tool call count exceeded", {
          code: "MAX_TOOL_ITERATIONS",
          details: { maxToolCalls }
        });
      }
      toolCallCount += 1;

      const duplicate = executedCalls.get(call.id);
      if (duplicate) {
        logger.event("tool.call.duplicate", { traceId, turnId, toolCallId: call.id, toolName: call.name, ...meta });
        if (duplicate.argsHash !== call.argsHash) {
          const conflict = {
            ok: false,
            code: "TOOL_CALL_CONFLICT",
            message: "duplicate tool call id had different arguments"
          };
          messages.push(toolResultMessage(call, conflict));
          debugMainAgent.toolCalls.push({
            id: call.id,
            name: call.name,
            args: call.args,
            status: "error",
            code: conflict.code,
            result: conflict
          });
          toolEvents.push({ id: call.id, name: call.name, status: "error", code: conflict.code });
          continue;
        }
        debugMainAgent.toolCalls.push({
          id: call.id,
          name: call.name,
          args: call.args,
          status: "duplicate",
          result: duplicate.result
        });
        messages.push(toolResultMessage(call, duplicate.result));
        continue;
      }

      const toolSpanId = createId("span");
      logger.event("tool.call.start", {
        traceId,
        spanId: toolSpanId,
        parentSpanId: providerSpanId,
        turnId,
        toolCallId: call.id,
        toolName: call.name,
        ...meta
      });
      const startedAt = Date.now();
      try {
        const result = await registry.execute(call.name, call.args, {
          turnId,
          traceId,
          signal: manager.signal,
          resourceManager: manager
        });
        const event = {
          id: call.id,
          name: call.name,
          status: "success",
          durationMs: Date.now() - startedAt
        };
        toolEvents.push(event);
        const toolResult = { ok: true, result };
        const surface = extractGguiSurface(result);
        if (surface) attachedSurfaces.push(surface);
        debugMainAgent.toolCalls.push({
          id: call.id,
          name: call.name,
          args: call.args,
          status: "success",
          durationMs: event.durationMs,
          result: toolResult
        });
        executedCalls.set(call.id, { argsHash: call.argsHash, result: toolResult });
        messages.push(toolResultMessage(call, toolResult));
        messages = compactMidTurnIfNeeded(messages, normalizedContext, memoryDebug);
        logger.event("tool.call.success", { traceId, spanId: toolSpanId, turnId, toolCallId: call.id, toolName: call.name, durationMs: event.durationMs, ...meta });
      } catch (error) {
        const event = {
          id: call.id,
          name: call.name,
          status: "error",
          code: error.code || "TOOL_EXECUTION_FAILED",
          durationMs: Date.now() - startedAt
        };
        toolEvents.push(event);
        const toolResult = { ok: false, error: serializeError(error) };
        debugMainAgent.toolCalls.push({
          id: call.id,
          name: call.name,
          args: call.args,
          status: "error",
          code: event.code,
          durationMs: event.durationMs,
          result: toolResult
        });
        executedCalls.set(call.id, { argsHash: call.argsHash, result: toolResult });
        messages.push(toolResultMessage(call, toolResult));
        messages = compactMidTurnIfNeeded(messages, normalizedContext, memoryDebug);
        logger.event("tool.call.error", {
          level: "error",
          traceId,
          spanId: toolSpanId,
          turnId,
          toolCallId: call.id,
          toolName: call.name,
          error: serializeError(error),
          ...meta
        });
      }
    }
    }
  } catch (error) {
    await manager.cleanup();
    throw error;
  }

  await manager.cleanup();
  throw new ToolExecutionError("max provider call count exceeded", {
    code: "MAX_TOOL_ITERATIONS",
    details: { maxProviderCalls }
  });
}

async function prepareMemoryDebug({ conversationId, message, memoryStore, contextOptions }) {
  const debug = {
    enabled: Boolean(conversationId && memoryStore),
    conversationId,
    loadedRevision: 0,
    persistedRevision: null,
    preTurnCompaction: null,
    midTurnCompactions: [],
    storePath: conversationId && memoryStore?.pathFor ? memoryStore.pathFor(conversationId) : undefined
  };
  if (!debug.enabled) {
    return { ...debug, memory: { summary: "", turns: [], revision: 0 } };
  }
  let memory = await memoryStore.read(conversationId);
  debug.loadedRevision = memory.revision;
  const compaction = maybeCompactMemory(memory, message, contextOptions);
  debug.preTurnCompaction = {
    triggered: compaction.compacted,
    estimatedTokens: compaction.estimatedTokens,
    thresholdTokens: compaction.thresholdTokens
  };
  if (compaction.compacted) {
    memory = await memoryStore.update(conversationId, () => compaction.memory);
    debug.persistedRevision = memory.revision;
    debug.preTurnCompaction.summary = compaction.summary;
  }
  return { ...debug, memory };
}

async function persistTurnMemory({ conversationId, memoryStore, memory, user, assistant }) {
  if (!conversationId || !memoryStore) return null;
  return memoryStore.update(conversationId, (current) => ({
    ...current,
    summary: current.summary || memory.summary || "",
    turns: [
      ...current.turns,
      {
        at: new Date().toISOString(),
        user: redactMemoryText(user),
        assistant: redactMemoryText(assistant)
      }
    ].slice(-12),
    compactedAt: current.compactedAt || memory.compactedAt || null
  }));
}

function compactMidTurnIfNeeded(messages, contextOptions, memoryDebug) {
  const compacted = compactTransientMessages(messages, contextOptions);
  memoryDebug.midTurnCompactions.push({
    triggered: compacted.compacted,
    estimatedTokens: compacted.estimatedTokens,
    thresholdTokens: compacted.thresholdTokens
  });
  return compacted.messages;
}

function contextDebug({ messages, options, memoryDebug, persistedMemory }) {
  return {
    contextWindowTokens: options.contextWindowTokens,
    compactionThreshold: options.compactionThreshold,
    compactionThresholdTokens: options.compactionThresholdTokens,
    estimatedTokens: estimateMessagesTokens(messages),
    memory: {
      enabled: memoryDebug.enabled,
      conversationId: memoryDebug.conversationId,
      loadedRevision: memoryDebug.loadedRevision,
      persistedRevision: persistedMemory?.revision ?? memoryDebug.persistedRevision,
      storePath: memoryDebug.storePath,
      preTurnCompaction: memoryDebug.preTurnCompaction,
      midTurnCompactions: memoryDebug.midTurnCompactions
    }
  };
}

function safeMetadata(metadata) {
  return metadata && typeof metadata === "object" ? Object.keys(metadata) : [];
}

function extractGguiSurface(result) {
  if (result?.kind === "ggui.surface" && result.surface) return result.surface;
  return null;
}

function snapshotMessages(messages) {
  return (messages || []).map((message) => ({
    role: message?.role,
    content: message?.content,
    tool_calls: (message?.tool_calls || []).map((toolCall) => ({
      id: toolCall?.id,
      type: toolCall?.type,
      function: {
        name: toolCall?.function?.name,
        arguments: toolCall?.function?.arguments
      }
    })),
    tool_call_id: message?.tool_call_id,
    name: message?.name
  }));
}

function snapshotTools(tools) {
  return (tools || []).map((tool) => ({
    type: tool?.type,
    function: {
      name: tool?.function?.name,
      description: tool?.function?.description
    }
  }));
}

function snapshotProviderResponse(response, assistantMessage, calls) {
  return {
    id: response?.id,
    model: response?.model,
    finishReason: response?.choices?.[0]?.finish_reason,
    assistantMessage: {
      role: assistantMessage?.role || "assistant",
      content: assistantMessage?.content || "",
      toolCalls: calls.map((call) => ({ id: call.id, name: call.name, args: call.args }))
    }
  };
}
