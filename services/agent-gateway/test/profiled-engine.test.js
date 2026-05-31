import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, ConfigValidationError } from "../src/config.js";
import { createServer } from "../src/index.js";

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test("POST /turn runs main and EXAONE through the same profiled engine entrypoint", async () => {
  const mainCalls = [];
  const exaoneCalls = [];
  const provider = {
    name: "fake-main",
    async complete(request) {
      mainCalls.push(request);
      return { id: "main_profiled", choices: [{ message: { content: "main profiled answer" } }] };
    }
  };
  const lmStudioClient = {
    name: "fake-lmstudio",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete(request) {
      exaoneCalls.push(request);
      return { id: "exaone_profiled", model: this.model, choices: [{ message: { content: "exaone profiled answer" } }] };
    }
  };
  const server = createServer({ mcpServers: {} }, {
    provider,
    lmStudioClient,
    logger: { event: () => {} }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "hello profiled" });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "exaone profiled answer");
    assert.equal(response.body.metadata.debug.profiledEngine.main.entrypoint, "runProfiledAgentTurn");
    assert.equal(response.body.metadata.debug.profiledEngine.exaone.entrypoint, "runProfiledAgentTurn");
    assert.equal(response.body.metadata.debug.mainAgent.profile.id, "main-agent");
    assert.equal(response.body.metadata.debug.exaone.profile.id, "exaone-agent");
    assert.equal(Object.hasOwn(response.body.metadata.debug.exaone.providerCalls[0].request, "tools"), false);
    assert.equal(Object.hasOwn(exaoneCalls[0], "tools"), false);
    assert.match(exaoneCalls[0].messages.at(-1).content, /메인 에이전트 결과: main profiled answer/);
    assert.equal(mainCalls.length, 1);
    assert.equal(exaoneCalls.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("emotional model can be switched by config and rejects unsupported allowlist", () => {
  const switched = loadConfig({
    OBA_EMOTIONAL_MODEL_NAME: "test-model",
    OBA_LLM_MODEL_ALLOWLIST: "test-model,exaone-4.0-1.2b"
  });
  assert.equal(switched.lmstudio.model, "test-model");
  assert.equal(switched.exaone.model, "test-model");

  assert.throws(
    () => loadConfig({
      OBA_EMOTIONAL_MODEL_NAME: "not-allowed",
      OBA_LLM_MODEL_ALLOWLIST: "exaone-4.0-1.2b"
    }),
    (error) => {
      assert.equal(error instanceof ConfigValidationError, true);
      assert.equal(error.envName, "OBA_EMOTIONAL_MODEL_NAME");
      return true;
    }
  );
});

test("EXAONE profile has defensive no-execute behavior if a provider violates disabled tool config", async () => {
  let registryExecuteCount = 0;
  const provider = {
    name: "fake-main",
    async complete() {
      return { id: "main", choices: [{ message: { content: "main answer" } }] };
    }
  };
  const lmStudioClient = {
    name: "fake-lmstudio",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete() {
      return {
        id: "exaone_tool_call",
        model: this.model,
        choices: [{
          message: {
            content: "도구 없이 답합니다.",
            tool_calls: [{
              id: "call_blocked",
              type: "function",
              function: { name: "read", arguments: "{\"path\":\"secret.txt\"}" }
            }]
          }
        }]
      };
    }
  };
  const registry = {
    specs: () => [{
      type: "function",
      function: { name: "read", description: "read", parameters: { type: "object" } }
    }],
    async execute() {
      registryExecuteCount += 1;
      return { ok: true };
    }
  };
  const server = createServer({ mcpServers: {} }, {
    provider,
    lmStudioClient,
    registry,
    logger: { event: () => {} }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "block exaone tool" });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "도구 없이 답합니다.");
    assert.equal(registryExecuteCount, 0);
    assert.equal(Object.hasOwn(response.body.metadata.debug.exaone.providerCalls[0].request, "tools"), false);
    assert.equal(response.body.metadata.debug.exaone.toolCalls[0].code, "PROFILE_TOOL_CALL_BLOCKED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
