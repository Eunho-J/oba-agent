import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loadConfig exposes LM Studio defaults for local EXAONE runtime", () => {
  const config = loadConfig({});
  assert.equal(config.lmstudio.baseUrl, "http://127.0.0.1:1234/v1");
  assert.equal(config.lmstudio.apiKey, "lm-studio");
  assert.equal(config.lmstudio.model, "exaone-4.0-1.2b");
  assert.equal(config.lmstudio.requestTimeoutMs, 15000);
  assert.equal(config.lmstudio.maxTokensCap, 1024);
  assert.equal(config.lmstudio.temperatureCap, 1);
  assert.deepEqual(config.lmstudio.modelAllowlist, ["exaone-4.0-1.2b"]);
});

test("loadConfig parses LM Studio overrides and trims trailing slash", () => {
  const config = loadConfig({
    OBA_LMSTUDIO_BASE_URL: "http://127.0.0.1:9123/v1///",
    OBA_LLM_API_KEY: "local-key",
    OBA_LLM_MODEL: "model-a",
    OBA_LLM_REQUEST_TIMEOUT_MS: "4500",
    OBA_LLM_MAX_TOKENS_CAP: "256",
    OBA_LLM_TEMPERATURE_CAP: "0.7",
    OBA_LLM_MODEL_ALLOWLIST: "model-a,model-b"
  });
  assert.equal(config.lmstudio.baseUrl, "http://127.0.0.1:9123/v1");
  assert.equal(config.lmstudio.apiKey, "local-key");
  assert.equal(config.lmstudio.model, "model-a");
  assert.equal(config.lmstudio.requestTimeoutMs, 4500);
  assert.equal(config.lmstudio.maxTokensCap, 256);
  assert.equal(config.lmstudio.temperatureCap, 0.7);
  assert.deepEqual(config.lmstudio.modelAllowlist, ["model-a", "model-b"]);
});

test("loadConfig validates hook configuration shape", () => {
  const config = loadConfig({
    OBA_HOOKS_JSON: JSON.stringify([{
      id: "safe-hook",
      event: "turn.before",
      command: "echo",
      failurePolicy: "diagnostic"
    }])
  });
  assert.equal(config.hooks.length, 1);
  assert.equal(config.hooks[0].id, "safe-hook");

  assert.throws(
    () => loadConfig({ OBA_HOOKS_JSON: "{\"id\":\"not-array\"}" }),
    (error) => error.envName === "OBA_HOOKS_JSON"
  );
});
