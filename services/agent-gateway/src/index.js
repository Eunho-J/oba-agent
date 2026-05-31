import http from "node:http";
import { loadConfig } from "./config.js";
import { createLogger, serializeError } from "./engine/logger.js";
import { createOpenAICompatibleProvider, deriveHealthUrl } from "./engine/provider.js";
import { createFileConversationMemoryStore } from "./engine/memory-store.js";
import {
  buildFinalAnswerMessages,
  buildInputTranslationMessages,
  chooseFinalAnswer,
  createLmStudioProfileProvider,
  normalizeMainAgentInput,
  runProfiledAgentTurn
} from "./engine/profiled-agent.js";
import { createStreamableHttpMcpAdapter } from "./mcp/adapter.js";
import { createDefaultToolRegistry } from "./tools/registry.js";
import { createApiFuseGuardService } from "./actions/apifuse-guard.js";
import { runGatewayWorkflow } from "./workflows/gateway-runner.js";
import { normalizeRenderIntentRequest, renderGguiSurface } from "./ggui/render.js";
import { searchImageGallerySurface } from "./ggui/image-search.js";
import { createLmStudioClient } from "./clients/exaone.js";
import { stageSelfImprovementCandidates, runSelfImprovementRegistrySmoke } from "./self-improvement.js";
import { transcribeVoiceRequest } from "./voice/whisper.js";
import { createSafeHookRunner, runHooksSafely } from "./engine/hooks.js";

const config = loadConfig();

export function createServer(appConfig = config, deps = {}) {
  const provider = deps.provider || createOpenAICompatibleProvider(appConfig.provider);
  const lmStudioClient = deps.lmStudioClient || createLmStudioClient(appConfig.lmstudio);
  const logger = deps.logger || createLogger();
  const memoryStore = deps.memoryStore || createFileConversationMemoryStore({
    rootPath: appConfig.context?.memoryRoot || ".oppa/conversations"
  });
  const fetchImpl = deps.fetch || fetch;
  const hookRunner = deps.hookRunner || createSafeHookRunner({
    hooks: appConfig.hooks || [],
    logger
  });
  const apifuseGuard = deps.apifuseGuard || createApiFuseGuardService({
    root: deps.workspace?.root || process.cwd(),
    apifuseConfig: appConfig.apifuse
  });
  const mcpAdapter = deps.mcpAdapter || createStreamableHttpMcpAdapter({
    config: { mcpServers: appConfig.mcpServers || {} },
    logger,
    clientFactory: deps.mcpClientFactory
  });
  const registryReady = deps.registry
    ? Promise.resolve(deps.registry)
    : createRuntimeRegistry({ workspace: deps.workspace, mcpAdapter, fetchImpl });
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        return sendNoContent(res, 204, corsHeaders);
      }

      if (req.method === "GET" && req.url === "/health") {
        return sendJson(res, 200, { ok: true }, corsHeaders);
      }

      if (req.method === "GET" && req.url === "/providers/health") {
        const providers = await collectProvidersHealth({
          appConfig,
          provider,
          lmStudioClient,
          fetchImpl
        });
        return sendJson(res, 200, { ok: true, providers }, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/turn") {
        const body = await readJson(req);
        validateTurnInput(body);
        const registry = await registryReady;
        const result = await runMainToExaoneTurn({
          appConfig,
          provider,
          lmStudioClient,
          registry,
          memoryStore,
          hookRunner,
          fetchImpl,
          logger,
          body
        });
        return sendJson(res, 200, result, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/agent/turn" && appConfig.enableAgentTurnAlias) {
        const body = await readJson(req);
        validateTurnInput(body);
        const registry = await registryReady;
        const result = await runMainToExaoneTurn({
          appConfig,
          provider,
          lmStudioClient,
          registry,
          memoryStore,
          hookRunner,
          fetchImpl,
          logger,
          body
        });
        return sendJson(res, 200, result, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/voice/transcribe") {
        const result = await transcribeVoiceRequest(req, {
          config: appConfig.voice || {},
          transcriber: deps.voiceTranscriber
        });
        return sendJson(res, 200, result, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/actions/apifuse/discover") {
        const body = await readJson(req);
        const result = await apifuseGuard.discover(body);
        return sendJson(res, 200, { ok: true, ...result }, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/actions/apifuse/prepare") {
        const body = await readJson(req);
        const result = await apifuseGuard.prepareAction(body);
        return sendJson(res, 200, { ok: true, ...result }, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/actions/apifuse/execute") {
        const body = await readJson(req);
        const result = await apifuseGuard.executeConfirmed(body);
        return sendJson(res, 200, { ok: true, ...result }, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/workflows/recall/run") {
        const body = await readJson(req);
        try {
          const result = await runGatewayWorkflow(body, {
            root: deps.workspace?.root || process.cwd()
          });
          return sendJson(res, 200, {
            ok: true,
            workflowId: result.workflowId,
            outputs: result.outputs
          }, corsHeaders);
        } catch (error) {
          if (String(error.code || "").startsWith("WORKFLOW_")) error.status = 400;
          throw error;
        }
      }

      if (req.method === "POST" && req.url === "/self-improvement/candidates") {
        const body = await readJson(req);
        const result = await stageSelfImprovementCandidates(body, {
          root: deps.workspace?.root || process.cwd()
        });
        return sendJson(res, 200, result, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/self-improvement/registry-smoke") {
        const body = await readJson(req);
        const result = await runSelfImprovementRegistrySmoke(body, {
          root: deps.workspace?.root || process.cwd()
        });
        return sendJson(res, 200, result, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/ggui/render") {
        const body = await readJson(req);
        const intent = normalizeRenderIntentRequest(body);
        const surface = renderGguiSurface(intent);
        return sendJson(res, 200, { ok: true, surface }, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/ggui/image-search") {
        const body = await readJson(req);
        const surface = await searchImageGallerySurface({
          query: body.query,
          title: body.title,
          limit: body.limit,
          fetchImpl
        });
        return sendJson(res, 200, { ok: true, surface }, corsHeaders);
      }

      if (req.method === "POST" && req.url === "/exaone/express") {
        const body = await readJson(req);
        const message = validateExpressInput(body);
        const completion = await completeExpressMessage(lmStudioClient, message);
        return sendJson(res, 200, {
          ok: true,
          text: extractAssistantText(completion),
          provider: lmStudioClient.name || "lmstudio-exaone",
          model: completion?.model || lmStudioClient.model || appConfig.lmstudio?.model,
          baseUrl: lmStudioClient.baseUrl || appConfig.lmstudio?.baseUrl
        }, corsHeaders);
      }

      sendJson(res, 404, { ok: false, error: "not_found" }, corsHeaders);
    } catch (error) {
      sendJson(res, error.status || 500, {
        ok: false,
        turnId: error.turnId,
        error: {
          message: error.message,
          code: error.code || "INTERNAL_ERROR",
          stack: error.stack,
          data: error.data,
          cause: error.cause ? serializeError(error.cause) : undefined
        }
      }, corsHeaders);
    }
  });
  server.on("close", () => {
    Promise.resolve(mcpAdapter.close?.()).catch((error) => {
      logger.event("mcp.close.error", { level: "error", error: serializeError(error) });
    });
  });
  return server;
}

async function createRuntimeRegistry({ workspace, mcpAdapter, fetchImpl }) {
  const registry = createDefaultToolRegistry({ workspace, fetchImpl });
  await mcpAdapter.discover(registry);
  return registry;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (cause) {
    throw validationError("request body must be valid JSON", cause);
  }
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendNoContent(res, status, extraHeaders = {}) {
  res.writeHead(status, extraHeaders);
  res.end();
}

function validateTurnInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("request body must be a JSON object");
  }
  const hasTurnTranscript = body.turn
    && typeof body.turn === "object"
    && "transcript" in body.turn;
  if ("audioText" in body || "transcript" in body || hasTurnTranscript) {
    throw validationError("POST /turn v1 accepts message only; send { message } instead of transcript/audioText");
  }
  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    throw validationError("message must be a non-empty string");
  }
  if (body.toolMode !== undefined && !["enabled", "disabled"].includes(body.toolMode)) {
    throw validationError("toolMode must be enabled or disabled");
  }
}

function validateExpressInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("request body must be a JSON object");
  }
  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    throw validationError("message must be a non-empty string");
  }
  return body.message.trim();
}

async function completeExpressMessage(lmStudioClient, message) {
  try {
    return await lmStudioClient.complete({
      messages: [
        {
          role: "system",
          content: "너는 한국어 표현을 다듬는 도우미다. 의미를 바꾸지 말고, 자연스럽고 정중한 한국어 한 문단으로 다듬어라."
        },
        { role: "user", content: message }
      ],
      temperature: 0.2,
      metadata: {
        mode: "llm.prompt",
        feature: "exaone.express"
      }
    });
  } catch (cause) {
    throw toLlmRequestError(cause);
  }
}

async function runMainToExaoneTurn({
  appConfig,
  provider,
  lmStudioClient,
  registry,
  memoryStore,
  hookRunner,
  fetchImpl,
  logger,
  body
}) {
  const hookDiagnostics = [
    ...await runHooksSafely(hookRunner, "turn.before", {
      message: body.message,
      conversationId: body.conversationId || "",
      metadata: body.metadata || {}
    }, { logger })
  ];
  const selfImprovementDiagnostics = await collectSelfImprovementDiagnostics({
    appConfig,
    fetchImpl,
    logger
  });
  const inputTranslationMessages = buildInputTranslationMessages({
    userMessage: body.message
  });
  const inputTranslationProvider = createLmStudioProfileProvider(lmStudioClient, {
    feature: "exaone.input_translation"
  });
  let inputTranslationResult;
  try {
    inputTranslationResult = await runProfiledAgentTurn({
      profileId: "exaone-agent",
      profiles: appConfig.agentProfiles,
      message: inputTranslationMessages.at(-1).content,
      initialMessages: inputTranslationMessages,
      conversationId: "",
      metadata: body.metadata || {},
      provider: inputTranslationProvider,
      registry,
      memoryStore: null,
      contextOptions: appConfig.context,
      turnTimeoutMs: appConfig.context?.turnTimeoutMs,
      logger,
      maxProviderCalls: 1,
      maxToolCalls: 0
    });
  } catch (error) {
    if (error.code === "PROVIDER_REQUEST_FAILED" && error.cause) {
      throw toLlmRequestError(error.cause);
    }
    throw error;
  }
  const normalizedInput = normalizeMainAgentInput({
    userMessage: body.message,
    translatedContent: inputTranslationResult.answer
  });
  const mainAgentInput = normalizedInput.text;
  const inputTranslationFallback = normalizedInput.fallbackToOriginal;
  const mainResult = await runProfiledAgentTurn({
    profileId: "main-agent",
    profiles: appConfig.agentProfiles,
    message: mainAgentInput,
    conversationId: body.conversationId || "",
    metadata: body.metadata || {},
    overrideToolMode: body.toolMode,
    provider,
    registry,
    memoryStore,
    contextOptions: appConfig.context,
    turnTimeoutMs: appConfig.context?.turnTimeoutMs,
    logger
  });
  const finalAnswerMessages = buildFinalAnswerMessages({ mainAgentAnswer: mainResult.answer });
  const exaoneProvider = createLmStudioProfileProvider(lmStudioClient, {
    feature: "exaone.final_answer"
  });
  let exaoneResult;
  try {
    exaoneResult = await runProfiledAgentTurn({
      profileId: "exaone-agent",
      profiles: appConfig.agentProfiles,
      message: finalAnswerMessages.at(-1).content,
      initialMessages: finalAnswerMessages,
      conversationId: "",
      metadata: body.metadata || {},
      provider: exaoneProvider,
      registry,
      memoryStore: null,
      contextOptions: appConfig.context,
      turnTimeoutMs: appConfig.context?.turnTimeoutMs,
      logger,
      maxProviderCalls: 1,
      maxToolCalls: 0
    });
  } catch (error) {
    if (error.code === "PROVIDER_REQUEST_FAILED" && error.cause) {
      throw toLlmRequestError(error.cause);
    }
    throw error;
  }
  const finalAnswerDecision = chooseFinalAnswer({
    mainAgentAnswer: mainResult.answer,
    exaoneAnswer: exaoneResult.answer
  });
  const exaoneFinalRawOutput = exaoneResult.answer;
  const exaoneFinalDeliveredOutput = finalAnswerDecision.answer;
  hookDiagnostics.push(...await runHooksSafely(hookRunner, "turn.after", {
    turnId: mainResult.turnId,
    traceId: mainResult.traceId,
    message: body.message,
    mainAgentInput,
    mainAgentAnswer: mainResult.answer,
    exaoneAnswer: exaoneFinalRawOutput,
    deliveredAnswer: exaoneFinalDeliveredOutput
  }, { logger }));
  const gguiAttachments = attachedGguiSurfaces(mainResult);
  const inlineSurface = gguiAttachments[0];
  return {
    ...mainResult,
    answer: finalAnswerDecision.answer,
    gguiAttachments,
    surface: inlineSurface,
    metadata: {
      ...(mainResult.metadata || {}),
      originalUserMessage: body.message,
      mainAgentInput,
      inputTranslationProvider: lmStudioClient.name || "lmstudio-exaone",
      inputTranslationModel: lmStudioClient.model,
      inputTranslationBaseUrl: lmStudioClient.baseUrl,
      inputTranslationMode: "exaone.input_translation",
      inputTranslationAnswer: inputTranslationResult.answer,
      inputTranslationFallback,
      inputTranslationFallbackReason: normalizedInput.reason || undefined,
      mainAgentAnswer: mainResult.answer,
      finalAnswerProvider: lmStudioClient.name || "lmstudio-exaone",
      finalAnswerModel: lmStudioClient.model,
      finalAnswerBaseUrl: lmStudioClient.baseUrl,
      finalAnswerMode: "exaone.final",
      finalAnswerFallback: finalAnswerDecision.fallbackToMainAnswer,
      finalAnswerFallbackReason: finalAnswerDecision.reason || undefined,
      ggui: gguiAttachments.length > 0
        ? {
          mode: "inline",
          count: gguiAttachments.length,
          types: gguiAttachments.map((surface) => surface.type)
        }
        : undefined,
      selfImprovement: selfImprovementDiagnostics,
      debug: {
        ...(mainResult?.metadata?.debug || {}),
        hooks: hookDiagnostics,
        selfImprovement: selfImprovementDiagnostics,
        mainAgent: {
          ...(mainResult?.metadata?.debug?.mainAgent || {}),
          output: mainResult.answer,
          profile: mainResult.metadata?.profile,
          originalUserMessage: body.message,
          mainAgentInput
        },
        inputTranslation: {
          ...(inputTranslationResult?.metadata?.debug?.mainAgent || {}),
          profile: inputTranslationResult.metadata?.profile,
          output: mainAgentInput,
          rawOutput: inputTranslationResult.answer,
          fallbackToOriginal: inputTranslationFallback,
          guard: normalizedInput.reason ? { reason: normalizedInput.reason } : undefined,
          model: lmStudioClient.model
        },
        exaoneInput: {
          ...(inputTranslationResult?.metadata?.debug?.mainAgent || {}),
          profile: inputTranslationResult.metadata?.profile,
          output: mainAgentInput,
          rawOutput: inputTranslationResult.answer,
          fallbackToOriginal: inputTranslationFallback,
          guard: normalizedInput.reason ? { reason: normalizedInput.reason } : undefined,
          model: lmStudioClient.model
        },
        exaoneFinal: {
          ...(exaoneResult?.metadata?.debug?.mainAgent || {}),
          profile: exaoneResult.metadata?.profile,
          output: exaoneFinalRawOutput,
          rawOutput: exaoneFinalRawOutput,
          deliveredOutput: exaoneFinalDeliveredOutput,
          fallbackToMainAnswer: finalAnswerDecision.fallbackToMainAnswer,
          guard: finalAnswerDecision.reason ? { reason: finalAnswerDecision.reason } : undefined,
          model: lmStudioClient.model
        },
        exaone: {
          ...(exaoneResult?.metadata?.debug?.mainAgent || {}),
          profile: exaoneResult.metadata?.profile,
          output: exaoneFinalRawOutput,
          rawOutput: exaoneFinalRawOutput,
          deliveredOutput: exaoneFinalDeliveredOutput,
          fallbackToMainAnswer: finalAnswerDecision.fallbackToMainAnswer,
          guard: finalAnswerDecision.reason ? { reason: finalAnswerDecision.reason } : undefined,
          model: lmStudioClient.model
        },
        profiledEngine: {
          main: mainResult.metadata?.debug?.profiledEngine,
          inputTranslation: inputTranslationResult.metadata?.debug?.profiledEngine,
          exaoneInput: inputTranslationResult.metadata?.debug?.profiledEngine,
          exaoneFinal: exaoneResult.metadata?.debug?.profiledEngine,
          exaone: exaoneResult.metadata?.debug?.profiledEngine
        }
      }
    }
  };
}

async function collectSelfImprovementDiagnostics({ appConfig, fetchImpl, logger }) {
  const codexImplementer = appConfig.selfImprovement?.codexImplementer;
  if (!codexImplementer?.enabled) {
    return {
      codexImplementer: {
        role: codexImplementer?.role || "isolated-implementer",
        runtime: false,
        enabled: false,
        available: false,
        diagnostic: "codex implementer probe disabled"
      }
    };
  }
  if (!codexImplementer.healthUrl) {
    return {
      codexImplementer: {
        role: codexImplementer.role,
        runtime: false,
        enabled: true,
        available: false,
        diagnostic: "codex implementer health URL is not configured"
      }
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), codexImplementer.timeoutMs);
  try {
    const response = await fetchImpl(codexImplementer.healthUrl, { signal: controller.signal });
    return {
      codexImplementer: {
        role: codexImplementer.role,
        runtime: false,
        enabled: true,
        available: response.ok,
        status: response.status,
        healthUrl: codexImplementer.healthUrl
      }
    };
  } catch (error) {
    logger.event("self_improvement.codex_implementer.unavailable", {
      level: "error",
      error: serializeError(error)
    });
    return {
      codexImplementer: {
        role: codexImplementer.role,
        runtime: false,
        enabled: true,
        available: false,
        healthUrl: codexImplementer.healthUrl,
        error: serializeError(error)
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

function attachedGguiSurfaces(agentResult) {
  const surfaces = agentResult?.metadata?.attachments?.surfaces;
  if (!Array.isArray(surfaces)) return [];
  return surfaces;
}

function extractAssistantText(completion) {
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (text) return text;
  }
  const error = new Error("LM Studio response did not include assistant text");
  error.code = "LLM_RESPONSE_INVALID";
  error.status = 502;
  throw error;
}

function snapshotCompletion(completion) {
  return {
    id: completion?.id,
    model: completion?.model,
    finishReason: completion?.choices?.[0]?.finish_reason,
    content: completion?.choices?.[0]?.message?.content
  };
}

async function collectProvidersHealth({ appConfig, provider, lmStudioClient, fetchImpl }) {
  const codexBaseUrl = provider.baseUrl || appConfig.provider?.baseUrl;
  const codexHealthUrl = codexBaseUrl ? deriveHealthUrl(codexBaseUrl) : null;
  const codexHealth = codexHealthUrl
    ? await probeJsonEndpoint(fetchImpl, codexHealthUrl)
    : unavailableHealth("provider baseUrl is missing");

  const lmStudioBaseUrl = lmStudioClient.baseUrl || appConfig.lmstudio?.baseUrl;
  const lmStudioModelsUrl = lmStudioBaseUrl ? `${lmStudioBaseUrl.replace(/\/+$/u, "")}/models` : null;
  const lmStudioHealth = lmStudioModelsUrl
    ? await probeJsonEndpoint(fetchImpl, lmStudioModelsUrl, {
      headers: buildAuthHeaders(appConfig.lmstudio?.apiKey)
    })
    : unavailableHealth("lmstudio baseUrl is missing");

  return {
    codexAsApi: {
      name: provider.name || appConfig.provider?.name || "codex-as-api",
      configured: Boolean(codexHealthUrl),
      baseUrl: codexBaseUrl,
      model: provider.model || appConfig.provider?.model,
      healthUrl: codexHealthUrl,
      reachable: codexHealth.reachable,
      status: codexHealth.status,
      error: codexHealth.error,
      details: codexHealth.body
    },
    lmstudio: {
      name: lmStudioClient.name || "lmstudio-exaone",
      configured: Boolean(lmStudioModelsUrl),
      baseUrl: lmStudioBaseUrl,
      model: lmStudioClient.model || appConfig.lmstudio?.model,
      modelsUrl: lmStudioModelsUrl,
      reachable: lmStudioHealth.reachable,
      status: lmStudioHealth.status,
      error: lmStudioHealth.error,
      modelCount: Array.isArray(lmStudioHealth.body?.data) ? lmStudioHealth.body.data.length : undefined
    }
  };
}

async function probeJsonEndpoint(fetchImpl, url, request = {}) {
  try {
    const response = await fetchImpl(url, { method: "GET", ...request });
    const body = await parseResponseBody(response);
    return {
      reachable: response.ok,
      status: response.status,
      body,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (cause) {
    return {
      reachable: false,
      status: null,
      body: undefined,
      error: cause instanceof Error ? cause.message : String(cause || "request_failed")
    };
  }
}

async function parseResponseBody(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function unavailableHealth(error) {
  return { reachable: false, status: null, body: undefined, error };
}

function buildAuthHeaders(apiKey) {
  if (!apiKey) return {};
  return { Authorization: `Bearer ${apiKey}` };
}

function toLlmRequestError(error) {
  const normalized = error instanceof Error ? error : new Error(String(error || "LM Studio request failed"));
  const wrapped = new Error(normalized.message, { cause: normalized });
  wrapped.code = normalized.code || "LLM_REQUEST_FAILED";
  wrapped.status = Number.isInteger(normalized.status) && normalized.status >= 400 ? normalized.status : 502;
  wrapped.data = normalized.data;
  return wrapped;
}

function validationError(message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  return error;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(config.port, () => {
    console.log(`agent-gateway listening on http://localhost:${config.port}`);
  });
}
