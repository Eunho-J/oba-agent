const REQUIRED_PROFILE_IDS = ["main-agent", "exaone-agent"];
const MEMORY_LANES = new Set(["reasoning", "expression"]);
const PROVIDER_ROUTES = new Set(["main", "emotional"]);

export class AgentProfileValidationError extends Error {
  constructor(message, { code = "AGENT_PROFILE_VALIDATION_FAILED", profileId, field } = {}) {
    super(message);
    this.name = "AgentProfileValidationError";
    this.code = code;
    this.profileId = profileId;
    this.field = field;
  }
}

export function createDefaultAgentProfiles() {
  return deepFreeze({
    "main-agent": {
      id: "main-agent",
      tools: true,
      mcp: true,
      ggui: true,
      memoryLane: "reasoning",
      selfImprovementSignals: true,
      providerRoute: "main"
    },
    "exaone-agent": {
      id: "exaone-agent",
      tools: false,
      mcp: false,
      ggui: false,
      memoryLane: "expression",
      selfImprovementSignals: false,
      providerRoute: "emotional"
    }
  });
}

export function normalizeAgentProfiles(input) {
  if (!isPlainObject(input)) {
    throw new AgentProfileValidationError("agent profiles must be a JSON object", {
      code: "AGENT_PROFILE_INVALID_ROOT"
    });
  }

  const normalized = {};
  for (const [profileId, rawProfile] of Object.entries(input)) {
    normalized[profileId] = normalizeProfile(rawProfile, profileId);
  }

  for (const requiredId of REQUIRED_PROFILE_IDS) {
    if (!normalized[requiredId]) {
      throw new AgentProfileValidationError(`missing required profile '${requiredId}'`, {
        code: "AGENT_PROFILE_REQUIRED_MISSING",
        profileId: requiredId
      });
    }
  }

  return deepFreeze(normalized);
}

export function getAgentProfile(profiles, profileId) {
  if (!isPlainObject(profiles)) {
    throw new AgentProfileValidationError("profiles must be an object", {
      code: "AGENT_PROFILE_STORE_INVALID"
    });
  }
  const profile = profiles[profileId];
  if (!profile) {
    throw new AgentProfileValidationError(`unknown agent profile '${profileId}'`, {
      code: "AGENT_PROFILE_NOT_FOUND",
      profileId
    });
  }
  return profile;
}

export function toolModeForProfile(profile) {
  return profile?.tools ? "enabled" : "disabled";
}

export function assertProfileAllowsTools(profile, profileId = profile?.id || "unknown") {
  if (!profile?.tools) {
    throw new AgentProfileValidationError(`profile '${profileId}' does not allow tools`, {
      code: "AGENT_PROFILE_TOOLS_DISABLED",
      profileId
    });
  }
}

function normalizeProfile(rawProfile, profileId) {
  if (!isPlainObject(rawProfile)) {
    throw new AgentProfileValidationError(`profile '${profileId}' must be an object`, {
      code: "AGENT_PROFILE_INVALID",
      profileId
    });
  }

  const tools = requireBoolean(rawProfile.tools, profileId, "tools");
  const mcp = requireBoolean(rawProfile.mcp, profileId, "mcp");
  const ggui = requireBoolean(rawProfile.ggui, profileId, "ggui");
  const selfImprovementSignals = requireBoolean(rawProfile.selfImprovementSignals, profileId, "selfImprovementSignals");
  const memoryLane = requireEnum(rawProfile.memoryLane, MEMORY_LANES, profileId, "memoryLane");
  const providerRoute = requireEnum(rawProfile.providerRoute, PROVIDER_ROUTES, profileId, "providerRoute");

  return deepFreeze({
    id: profileId,
    tools,
    mcp,
    ggui,
    memoryLane,
    selfImprovementSignals,
    providerRoute
  });
}

function requireBoolean(value, profileId, field) {
  if (typeof value !== "boolean") {
    throw new AgentProfileValidationError(`profile '${profileId}' field '${field}' must be a boolean`, {
      code: "AGENT_PROFILE_FIELD_INVALID",
      profileId,
      field
    });
  }
  return value;
}

function requireEnum(value, allowlist, profileId, field) {
  if (typeof value !== "string" || !allowlist.has(value)) {
    throw new AgentProfileValidationError(
      `profile '${profileId}' field '${field}' must be one of: ${Array.from(allowlist).join(", ")}`,
      {
        code: "AGENT_PROFILE_FIELD_INVALID",
        profileId,
        field
      }
    );
  }
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}
