import { createDefaultAgentProfiles, normalizeAgentProfiles } from "./engine/profiles.js";

export function loadConfig(env = process.env) {
  const lmstudio = loadLmStudioConfig(env);
  return {
    port: Number(env.PORT || 8787),
    publicAppUrl: env.PUBLIC_APP_URL || "http://localhost:8787",
    localWorkflow: {
      enabled: env.OBA_LOCAL_WORKFLOW_ENABLED !== "0",
      registryPath: env.OBA_LOCAL_WORKFLOW_REGISTRY || ".oppa/registry",
      workflowPath: env.OBA_LOCAL_WORKFLOW_PATH || ".oppa/workflows"
    },
    apifuse: {
      baseUrl: trimTrailingSlash(env.APIFUSE_BASE_URL || "https://api.apifuse.com"),
      apiKey: env.APIFUSE_API_KEY || ""
    },
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY || "",
      model: env.OPENROUTER_MODEL || "google/gemini-3.5-flash"
    },
    lmstudio,
    voice: {
      whisperBin: env.OBA_WHISPER_CPP_BIN || env.WHISPER_CPP_BIN || "whisper-cli",
      whisperModel: env.OBA_WHISPER_CPP_MODEL || env.WHISPER_CPP_MODEL || "",
      ffmpegBin: env.OBA_FFMPEG_BIN || "ffmpeg",
      whisperExtraArgs: parseCsvEnv(env.OBA_WHISPER_CPP_ARGS || ""),
      uploadMaxBytes: parsePositiveIntegerEnv(env.OBA_VOICE_UPLOAD_MAX_BYTES, 10 * 1024 * 1024, "OBA_VOICE_UPLOAD_MAX_BYTES")
    },
    exaone: {
      baseUrl: lmstudio.baseUrl,
      apiKey: lmstudio.apiKey,
      model: lmstudio.model,
      expressionPromptPath: env.EXAONE_EXPRESSION_PROMPT_PATH || "prompts/exaone-expression.md"
    },
    provider: {
      baseUrl: trimTrailingSlash(env.OBA_PROVIDER_BASE_URL || "http://127.0.0.1:18080/v1"),
      apiKey: env.OBA_PROVIDER_API_KEY || "unused",
      model: env.OBA_PROVIDER_MODEL || "gpt-5.5",
      name: env.OBA_PROVIDER_NAME || "codex-as-api"
    },
    context: {
      memoryRoot: env.OBA_CONTEXT_MEMORY_ROOT || ".oppa/conversations",
      contextWindowTokens: parsePositiveIntegerEnv(env.OBA_CONTEXT_WINDOW_TOKENS, 8000, "OBA_CONTEXT_WINDOW_TOKENS"),
      compactionThreshold: parseThresholdEnv(env.OBA_CONTEXT_COMPACTION_THRESHOLD, 0.9, "OBA_CONTEXT_COMPACTION_THRESHOLD"),
      turnTimeoutMs: parsePositiveIntegerEnv(env.OBA_TURN_TIMEOUT_MS, 30000, "OBA_TURN_TIMEOUT_MS")
    },
    hooks: parseHooksEnv(env.OBA_HOOKS_JSON),
    selfImprovement: {
      codexImplementer: {
        enabled: env.OBA_CODEX_IMPLEMENTER_ENABLED === "1",
        healthUrl: env.OBA_CODEX_IMPLEMENTER_HEALTH_URL || "",
        timeoutMs: parsePositiveIntegerEnv(env.OBA_CODEX_IMPLEMENTER_TIMEOUT_MS, 500, "OBA_CODEX_IMPLEMENTER_TIMEOUT_MS"),
        role: "isolated-implementer",
        runtime: false
      }
    },
    agentProfiles: parseAgentProfilesEnv(env.OBA_AGENT_PROFILES_JSON),
    mcpServers: parseJsonEnv(env.OBA_MCP_SERVERS_JSON || "{}", "OBA_MCP_SERVERS_JSON")
  };
}

export class ConfigValidationError extends Error {
  constructor(message, { code = "CONFIG_VALIDATION_FAILED", envName, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ConfigValidationError";
    this.code = code;
    this.envName = envName;
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function loadLmStudioConfig(env) {
  const model = env.OBA_EMOTIONAL_MODEL_NAME || env.OBA_LLM_MODEL || env.EXAONE_MODEL || "exaone-4.0-1.2b";
  const modelAllowlist = parseCsvEnv(env.OBA_LLM_MODEL_ALLOWLIST || model);
  if (!modelAllowlist.includes(model)) {
    throw new ConfigValidationError("OBA_EMOTIONAL_MODEL_NAME/OBA_LLM_MODEL must be included in OBA_LLM_MODEL_ALLOWLIST", {
      envName: "OBA_EMOTIONAL_MODEL_NAME"
    });
  }
  return {
    baseUrl: trimTrailingSlash(env.OBA_LMSTUDIO_BASE_URL || env.EXAONE_BASE_URL || "http://127.0.0.1:1234/v1"),
    apiKey: env.OBA_LLM_API_KEY || env.EXAONE_API_KEY || "lm-studio",
    model,
    requestTimeoutMs: parsePositiveIntegerEnv(env.OBA_LLM_REQUEST_TIMEOUT_MS, 15000, "OBA_LLM_REQUEST_TIMEOUT_MS"),
    maxTokensCap: parsePositiveIntegerEnv(env.OBA_LLM_MAX_TOKENS_CAP, 1024, "OBA_LLM_MAX_TOKENS_CAP"),
    temperatureCap: parsePositiveNumberEnv(env.OBA_LLM_TEMPERATURE_CAP, 1, "OBA_LLM_TEMPERATURE_CAP"),
    modelAllowlist
  };
}

function parsePositiveIntegerEnv(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parsePositiveNumberEnv(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

function parseThresholdEnv(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }
  return parsed;
}

function parseCsvEnv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseJsonEnv(value, name) {
  try {
    return JSON.parse(value);
  } catch (cause) {
    throw new ConfigValidationError(`${name} must be valid JSON`, {
      envName: name,
      cause
    });
  }
}

function parseHooksEnv(value) {
  const parsed = parseJsonEnv(value || "[]", "OBA_HOOKS_JSON");
  if (!Array.isArray(parsed)) {
    throw new ConfigValidationError("OBA_HOOKS_JSON must be a JSON array", {
      envName: "OBA_HOOKS_JSON"
    });
  }
  return parsed;
}

function parseAgentProfilesEnv(value) {
  if (value === undefined || value === "") {
    return createDefaultAgentProfiles();
  }

  const parsed = parseJsonEnv(value, "OBA_AGENT_PROFILES_JSON");
  try {
    return normalizeAgentProfiles(parsed);
  } catch (cause) {
    throw new ConfigValidationError(`OBA_AGENT_PROFILES_JSON is invalid: ${cause.message}`, {
      envName: "OBA_AGENT_PROFILES_JSON",
      cause
    });
  }
}
