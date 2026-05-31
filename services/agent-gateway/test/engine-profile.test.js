import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, ConfigValidationError } from "../src/config.js";
import { runAgentTurn } from "../src/engine/agent.js";
import {
  AgentProfileValidationError,
  assertProfileAllowsTools,
  createDefaultAgentProfiles,
  getAgentProfile,
  normalizeAgentProfiles,
  toolModeForProfile
} from "../src/engine/profiles.js";

function scriptedProvider(responses, calls = []) {
  return {
    name: "scripted",
    async complete(request) {
      calls.push(request);
      return responses.shift();
    }
  };
}

function response(message, id = "resp_profile_test") {
  return { id, choices: [{ message }] };
}

test("default agent profiles match planned capability split", () => {
  const profiles = createDefaultAgentProfiles();
  const main = getAgentProfile(profiles, "main-agent");
  const exaone = getAgentProfile(profiles, "exaone-agent");

  assert.equal(main.tools, true);
  assert.equal(main.mcp, true);
  assert.equal(main.ggui, true);
  assert.equal(main.memoryLane, "reasoning");
  assert.equal(main.selfImprovementSignals, true);
  assert.equal(main.providerRoute, "main");

  assert.equal(exaone.tools, false);
  assert.equal(exaone.mcp, false);
  assert.equal(exaone.ggui, false);
  assert.equal(exaone.memoryLane, "expression");
  assert.equal(exaone.selfImprovementSignals, false);
  assert.equal(exaone.providerRoute, "emotional");
});

test("normalizeAgentProfiles deep-freezes output and rejects mutation", () => {
  const normalized = normalizeAgentProfiles({
    "main-agent": {
      tools: true,
      mcp: true,
      ggui: true,
      memoryLane: "reasoning",
      selfImprovementSignals: true,
      providerRoute: "main"
    },
    "exaone-agent": {
      tools: false,
      mcp: false,
      ggui: false,
      memoryLane: "expression",
      selfImprovementSignals: false,
      providerRoute: "emotional"
    }
  });

  assert.throws(() => {
    normalized["main-agent"].tools = false;
  }, /read only|frozen|assign/i);
  assert.equal(normalized["main-agent"].tools, true);
});

test("loadConfig wraps malformed profile JSON in ConfigValidationError", () => {
  assert.throws(
    () => loadConfig({ OBA_AGENT_PROFILES_JSON: "{" }),
    (error) => {
      assert.equal(error instanceof ConfigValidationError, true);
      assert.equal(error.envName, "OBA_AGENT_PROFILES_JSON");
      return true;
    }
  );
});

test("loadConfig rejects malformed profile shape with typed error", () => {
  assert.throws(
    () => loadConfig({
      OBA_AGENT_PROFILES_JSON: JSON.stringify({
        "main-agent": {
          tools: true,
          mcp: true,
          ggui: true,
          memoryLane: "reasoning",
          selfImprovementSignals: true,
          providerRoute: "main"
        },
        "exaone-agent": {
          tools: "false",
          mcp: false,
          ggui: false,
          memoryLane: "expression",
          selfImprovementSignals: false,
          providerRoute: "emotional"
        }
      })
    }),
    (error) => {
      assert.equal(error instanceof ConfigValidationError, true);
      assert.equal(error.envName, "OBA_AGENT_PROFILES_JSON");
      assert.equal(error.cause instanceof AgentProfileValidationError, true);
      assert.match(error.message, /is invalid/);
      return true;
    }
  );
});

test("exaone profile resolves to toolMode disabled and sends no tools", async () => {
  const providerCalls = [];
  const provider = scriptedProvider([response({ content: "no tools" })], providerCalls);
  const exaoneProfile = getAgentProfile(createDefaultAgentProfiles(), "exaone-agent");
  const result = await runAgentTurn({
    message: "hello",
    toolMode: toolModeForProfile(exaoneProfile),
    provider,
    logger: { event: () => {} }
  });

  assert.equal(result.answer, "no tools");
  assert.equal(Object.hasOwn(providerCalls[0], "tools"), false);
  assert.throws(() => assertProfileAllowsTools(exaoneProfile), (error) => {
    assert.equal(error.code, "AGENT_PROFILE_TOOLS_DISABLED");
    return true;
  });
});
