import { postJson } from "./http.js";

const DEFAULT_LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_LLM_MODEL = "exaone-4.0-1.2b";
const DEFAULT_LLM_API_KEY = "lm-studio";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_TOKENS_CAP = 1024;
const DEFAULT_TEMPERATURE_CAP = 1;

const TOOL_FIELDS = new Set(["tools", "tool_choice", "parallel_tool_calls", "functions", "function_call"]);

export class LlmContractError extends Error {
  constructor(code, message, { status, data, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export function normalizeLmStudioConfig({
  baseUrl = process.env.OBA_LMSTUDIO_BASE_URL || process.env.EXAONE_BASE_URL || DEFAULT_LMSTUDIO_BASE_URL,
  apiKey = process.env.OBA_LLM_API_KEY || process.env.EXAONE_API_KEY || DEFAULT_LLM_API_KEY,
  model = process.env.OBA_LLM_MODEL || process.env.EXAONE_MODEL || DEFAULT_LLM_MODEL,
  requestTimeoutMs = process.env.OBA_LLM_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
  maxTokensCap = process.env.OBA_LLM_MAX_TOKENS_CAP || DEFAULT_MAX_TOKENS_CAP,
  temperatureCap = process.env.OBA_LLM_TEMPERATURE_CAP || DEFAULT_TEMPERATURE_CAP,
  modelAllowlist = process.env.OBA_LLM_MODEL_ALLOWLIST || model
} = {}) {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  if (!normalizedBaseUrl) {
    throw new LlmContractError("LLM_CONFIG_INVALID", "OBA_LMSTUDIO_BASE_URL is required");
  }
  const normalizedModel = String(model || "").trim();
  if (!normalizedModel) {
    throw new LlmContractError("LLM_CONFIG_INVALID", "OBA_LLM_MODEL is required");
  }
  return {
    baseUrl: normalizedBaseUrl,
    apiKey: String(apiKey || DEFAULT_LLM_API_KEY),
    model: normalizedModel,
    requestTimeoutMs: parsePositiveInteger(requestTimeoutMs, "OBA_LLM_REQUEST_TIMEOUT_MS"),
    maxTokensCap: parsePositiveInteger(maxTokensCap, "OBA_LLM_MAX_TOKENS_CAP"),
    temperatureCap: parsePositiveNumber(temperatureCap, "OBA_LLM_TEMPERATURE_CAP"),
    modelAllowlist: parseAllowlist(modelAllowlist, normalizedModel)
  };
}

export function createLmStudioClient(config = {}) {
  const normalized = normalizeLmStudioConfig(config);
  return {
    name: "lmstudio-exaone",
    model: normalized.model,
    baseUrl: normalized.baseUrl,
    config: normalized,
    async complete(request = {}) {
      const body = buildLmStudioChatBody(normalized, request);
      const { signal, cleanup } = createTimeoutSignal({
        timeoutMs: normalized.requestTimeoutMs,
        upstreamSignal: request.signal
      });
      try {
        return await postJson(`${normalized.baseUrl}/chat/completions`, {
          headers: normalized.apiKey
            ? { Authorization: `Bearer ${normalized.apiKey}` }
            : {},
          body,
          signal
        });
      } catch (error) {
        if (error instanceof LlmContractError) throw error;
        if (error?.name === "AbortError") {
          throw new LlmContractError(
            "LLM_REQUEST_FAILED",
            `LM Studio request timed out after ${normalized.requestTimeoutMs}ms`,
            { status: 504, cause: error }
          );
        }
        throw new LlmContractError("LLM_REQUEST_FAILED", "LM Studio request failed", {
          status: error?.status,
          data: error?.data,
          cause: error
        });
      } finally {
        cleanup();
      }
    }
  };
}

export function createRequestFromFixture(fixture) {
  const mode = fixture?.mode;
  if (mode === "llm.prompt") return buildPromptRequestFromFixture(fixture);
  if (mode === "llm.classify") return buildClassifyRequestFromFixture(fixture);
  throw new LlmContractError("LLM_FIXTURE_INVALID", "fixture.mode must be llm.prompt or llm.classify");
}

export function buildPromptRequestFromFixture(fixture) {
  const messages = Array.isArray(fixture?.messages) && fixture.messages.length > 0
    ? fixture.messages
    : [{ role: "user", content: String(fixture?.input || fixture?.prompt || "") }];
  return {
    model: fixture?.model,
    messages,
    temperature: fixture?.temperature,
    max_tokens: fixture?.max_tokens,
    tools: fixture?.tools,
    tool_choice: fixture?.tool_choice,
    metadata: {
      mode: "llm.prompt"
    }
  };
}

export function buildClassifyRequestFromFixture(fixture) {
  const labels = Array.isArray(fixture?.labels) ? fixture.labels.filter(Boolean).map(String) : [];
  if (labels.length === 0) {
    throw new LlmContractError("LLM_FIXTURE_INVALID", "llm.classify fixture requires labels");
  }
  const instructions = String(
    fixture?.instructions || "Return exactly one label from the provided label set."
  ).trim();
  const input = String(fixture?.input || fixture?.text || "").trim();
  if (!input) {
    throw new LlmContractError("LLM_FIXTURE_INVALID", "llm.classify fixture requires input");
  }
  return {
    model: fixture?.model,
    messages: [
      {
        role: "system",
        content: `${instructions}\nlabels: ${labels.join(", ")}`
      },
      {
        role: "user",
        content: input
      }
    ],
    temperature: 0,
    max_tokens: fixture?.max_tokens,
    metadata: {
      mode: "llm.classify",
      labels
    }
  };
}

export function buildLmStudioChatBody(config, request = {}) {
  rejectToolFields(request);
  const model = String(request.model || config.model || "").trim();
  assertModelAllowed(model, config.modelAllowlist);
  const messages = normalizeMessages(request.messages);
  const maxTokens = clampPositiveInteger(
    request.max_tokens ?? request.maxTokens ?? config.maxTokensCap,
    config.maxTokensCap
  );
  const temperature = clampNumber(request.temperature ?? 0.2, 0, config.temperatureCap);
  return {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    ...(request.metadata ? { metadata: request.metadata } : {})
  };
}

export function callExaoneChat({ baseUrl, apiKey, model, messages, ...rest }) {
  const client = createLmStudioClient({ baseUrl, apiKey, model });
  return client.complete({ messages, ...rest });
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new LlmContractError("LLM_REQUEST_INVALID", "messages must be a non-empty array");
  }
  return messages.map((message) => ({
    role: String(message?.role || "user"),
    content: String(message?.content || "")
  }));
}

function rejectToolFields(request) {
  for (const field of TOOL_FIELDS) {
    if (request[field] !== undefined) {
      throw new LlmContractError(
        "LLM_TOOLS_NOT_ALLOWED",
        "LM Studio MVP does not allow tool-calling fields"
      );
    }
  }
}

function assertModelAllowed(model, allowlist) {
  if (!allowlist.includes(model)) {
    throw new LlmContractError(
      "LLM_MODEL_NOT_ALLOWED",
      `model "${model}" is not in OBA_LLM_MODEL_ALLOWLIST`,
      { status: 400, data: { model, allowlist } }
    );
  }
}

function createTimeoutSignal({ timeoutMs, upstreamSignal }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("request timeout"));
  }, timeoutMs);
  let removeAbortListener = null;
  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort(upstreamSignal.reason);
    } else {
      const onAbort = () => controller.abort(upstreamSignal.reason);
      upstreamSignal.addEventListener("abort", onAbort, { once: true });
      removeAbortListener = () => upstreamSignal.removeEventListener("abort", onAbort);
    }
  }
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      removeAbortListener?.();
    }
  };
}

function parseAllowlist(value, fallbackModel) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  if (values.length > 0) return values;
  return [fallbackModel];
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new LlmContractError("LLM_CONFIG_INVALID", `${name} must be a positive integer`);
  }
  return parsed;
}

function parsePositiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new LlmContractError("LLM_CONFIG_INVALID", `${name} must be a positive number`);
  }
  return parsed;
}

function clampPositiveInteger(value, cap) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return cap;
  return Math.min(Math.floor(parsed), cap);
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
