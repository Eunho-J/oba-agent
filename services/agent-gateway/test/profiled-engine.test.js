import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, ConfigValidationError } from "../src/config.js";
import { createServer } from "../src/index.js";

function extractTaggedBlock(content, tag) {
  const text = String(content || "");
  const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "u");
  const match = text.match(regex);
  return match?.[1]?.trim() || "";
}

function findFeatureCall(calls, feature) {
  return calls.find((call) => call?.metadata?.feature === feature);
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test("POST /turn runs EXAONE input translation before main and EXAONE final expression", async () => {
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
      const feature = request?.metadata?.feature;
      if (feature === "exaone.input_translation") {
        const rawUser = extractTaggedBlock(request.messages.at(-1).content, "user");
        return {
          id: "exaone_input_profiled",
          model: this.model,
          choices: [{ message: { content: `[agent]${rawUser} translated for main[/agent]` } }]
        };
      }
      if (feature === "exaone.final_answer") {
        return { id: "exaone_final_profiled", model: this.model, choices: [{ message: { content: "exaone profiled answer" } }] };
      }
      throw new Error(`unexpected EXAONE feature: ${String(feature)}`);
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
    assert.equal(response.body.metadata.debug.profiledEngine.exaoneFinal.entrypoint, "runProfiledAgentTurn");
    assert.equal(response.body.metadata.debug.mainAgent.profile.id, "main-agent");
    assert.equal(response.body.metadata.debug.inputTranslation.profile.id, "exaone-agent");
    assert.equal(response.body.metadata.debug.exaoneFinal.profile.id, "exaone-agent");
    assert.equal(response.body.metadata.originalUserMessage, "hello profiled");
    assert.equal(response.body.metadata.mainAgentInput, "hello profiled translated for main");

    const inputCall = findFeatureCall(exaoneCalls, "exaone.input_translation");
    const finalCall = findFeatureCall(exaoneCalls, "exaone.final_answer");
    assert.ok(inputCall);
    assert.ok(finalCall);
    assert.equal(Object.hasOwn(inputCall, "tools"), false);
    assert.equal(Object.hasOwn(finalCall, "tools"), false);
    assert.match(inputCall.messages.at(-1).content, /\[user\]\s*hello profiled\s*\[\/user\]/);
    assert.match(inputCall.messages.at(-1).content, /\[agent\]/);
    assert.match(finalCall.messages.at(-1).content, /\[user\]\s*hello profiled\s*\[\/user\]/);
    assert.match(finalCall.messages.at(-1).content, /\[agent\]\s*main profiled answer\s*\[\/agent\]/);
    assert.equal(mainCalls[0].messages.at(-1).content, "hello profiled translated for main");
    assert.equal(mainCalls.length, 1);
    assert.equal(exaoneCalls.length, 2);
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
    async complete(request) {
      if (request?.metadata?.feature === "exaone.input_translation") {
        return {
          id: "exaone_input_tool_call",
          model: this.model,
          choices: [{ message: { content: "[agent]block exaone tool[/agent]" } }]
        };
      }
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
    assert.equal(Object.hasOwn(response.body.metadata.debug.exaoneFinal.providerCalls[0].request, "tools"), false);
    assert.equal(response.body.metadata.debug.exaoneFinal.toolCalls[0].code, "PROFILE_TOOL_CALL_BLOCKED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /turn falls back to raw user input when EXAONE translation does not return [agent] text", async () => {
  const mainCalls = [];
  const provider = {
    name: "fake-main",
    async complete(request) {
      mainCalls.push(request);
      return { id: "main_fallback", choices: [{ message: { content: "main fallback answer" } }] };
    }
  };
  const lmStudioClient = {
    name: "fake-lmstudio",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete(request) {
      if (request?.metadata?.feature === "exaone.input_translation") {
        return {
          id: "exaone_input_missing_tag",
          model: this.model,
          choices: [{ message: { content: "translation without required tag" } }]
        };
      }
      return {
        id: "exaone_fallback_final",
        model: this.model,
        choices: [{ message: { content: "exaone fallback final" } }]
      };
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
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "fallback me" });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "exaone fallback final");
    assert.equal(mainCalls.length, 1);
    assert.equal(mainCalls[0].messages.at(-1).content, "fallback me");
    assert.equal(response.body.metadata.mainAgentInput, "fallback me");
    assert.equal(response.body.metadata.debug.inputTranslation.fallbackToOriginal, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
