const CHARS_PER_TOKEN = 4;

export function estimateTextTokens(value) {
  const text = String(value || "");
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function estimateMessageTokens(message) {
  if (!message || typeof message !== "object") return 0;
  let total = estimateTextTokens(message.role);
  total += estimateTextTokens(message.content);
  if (Array.isArray(message.tool_calls)) {
    total += estimateTextTokens(JSON.stringify(message.tool_calls));
  }
  if (message.name) total += estimateTextTokens(message.name);
  if (message.tool_call_id) total += estimateTextTokens(message.tool_call_id);
  return total;
}

export function estimateMessagesTokens(messages) {
  return (Array.isArray(messages) ? messages : []).reduce((sum, message) => {
    return sum + estimateMessageTokens(message);
  }, 0);
}

export function normalizeContextOptions(options = {}) {
  const contextWindowTokens = positiveInteger(options.contextWindowTokens, 8000);
  const compactionThreshold = positiveNumber(options.compactionThreshold, 0.9);
  return {
    contextWindowTokens,
    compactionThreshold,
    compactionThresholdTokens: Math.floor(contextWindowTokens * compactionThreshold)
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
}
