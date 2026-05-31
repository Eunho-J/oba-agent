import { estimateMessagesTokens, normalizeContextOptions } from "./token-accounting.js";

const MAX_SUMMARY_CHARS = 1600;
const RECENT_TURNS_TO_KEEP = 2;

export function buildContextMessages({ baseMessages, memory }) {
  if (!memory || (!memory.summary && memory.turns.length === 0)) return baseMessages;
  const [systemMessage, ...rest] = baseMessages;
  const memoryMessages = [];
  if (memory.summary) {
    memoryMessages.push({
      role: "system",
      content: `Conversation memory summary:\n${memory.summary}`
    });
  }
  for (const turn of memory.turns.slice(-RECENT_TURNS_TO_KEEP)) {
    memoryMessages.push({ role: "user", content: turn.user });
    memoryMessages.push({ role: "assistant", content: turn.assistant });
  }
  return [systemMessage, ...memoryMessages, ...rest];
}

export function maybeCompactMemory(memory, currentMessage, options = {}) {
  const normalized = normalizeContextOptions(options);
  const messages = buildContextMessages({
    baseMessages: [
      { role: "system", content: "" },
      { role: "user", content: currentMessage }
    ],
    memory
  });
  const estimatedTokens = estimateMessagesTokens(messages);
  if (estimatedTokens <= normalized.compactionThresholdTokens) {
    return {
      compacted: false,
      memory,
      estimatedTokens,
      thresholdTokens: normalized.compactionThresholdTokens
    };
  }

  const compacted = compactMemory(memory, currentMessage);
  return {
    compacted: true,
    memory: compacted,
    estimatedTokens,
    thresholdTokens: normalized.compactionThresholdTokens,
    summary: compacted.summary
  };
}

export function compactTransientMessages(messages, options = {}) {
  const normalized = normalizeContextOptions(options);
  const estimatedTokens = estimateMessagesTokens(messages);
  if (estimatedTokens <= normalized.compactionThresholdTokens || messages.length <= 4) {
    return {
      compacted: false,
      messages,
      estimatedTokens,
      thresholdTokens: normalized.compactionThresholdTokens
    };
  }

  const [systemMessage, ...tail] = messages;
  const recent = tail.slice(-4);
  const summarized = tail.slice(0, -4)
    .map((message) => `${message.role}: ${String(message.content || "").slice(0, 180)}`)
    .join("\n");
  return {
    compacted: true,
    messages: [
      systemMessage,
      {
        role: "system",
        content: `Mid-turn compacted context:\n${summarized.slice(-MAX_SUMMARY_CHARS)}`
      },
      ...recent
    ],
    estimatedTokens,
    thresholdTokens: normalized.compactionThresholdTokens
  };
}

function compactMemory(memory, currentMessage) {
  const previousSummary = memory.summary ? `${memory.summary}\n` : "";
  const olderTurns = memory.turns.slice(0, -RECENT_TURNS_TO_KEEP);
  const recentTurns = memory.turns.slice(-RECENT_TURNS_TO_KEEP);
  const newSummary = [
    previousSummary.trim(),
    ...olderTurns.map((turn) => `- user: ${turn.user}\n  assistant: ${turn.assistant}`),
    `- current user intent: ${String(currentMessage || "").slice(0, 240)}`
  ]
    .filter(Boolean)
    .join("\n")
    .slice(-MAX_SUMMARY_CHARS);
  return {
    ...memory,
    summary: newSummary,
    turns: recentTurns,
    compactedAt: new Date().toISOString()
  };
}
