import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runAgentTurn } from "../src/engine/agent.js";
import { OBA_PROMPT_VERSION, OBA_TOOL_SCHEMA_VERSION, buildInitialMessages } from "../src/engine/prompt.js";
import { createLogger } from "../src/engine/logger.js";
import { parseToolCalls } from "../src/engine/tool-calls.js";
import { createDefaultToolRegistry } from "../src/tools/registry.js";
import { createWorkspace } from "../src/tools/workspace.js";

function scriptedProvider(responses, calls = []) {
  return {
    name: "scripted",
    async complete(request) {
      calls.push(request);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    }
  };
}

function response(message, id = "resp_test") {
  return { id, choices: [{ message }] };
}

function toolCall({ id = "call_1", name = "read", args = {} } = {}) {
  return {
    id,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args)
    }
  };
}

function commonsFetchFixture() {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        query: {
          pages: {
            "1": {
              title: "File:Restaurant.jpg",
              imageinfo: [{
                url: "https://upload.wikimedia.org/wikipedia/commons/example/Restaurant.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Restaurant.jpg",
                extmetadata: {
                  ImageDescription: { value: "<p>Restaurant interior</p>" }
                }
              }]
            }
          }
        }
      };
    }
  });
}

async function registryFixture(options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-engine-"));
  const registry = createDefaultToolRegistry({ workspace: createWorkspace({ root }), ...options });
  return { root, registry };
}

test("stable prompt assembly keeps dynamic values out of the system prompt", () => {
  const messages = buildInitialMessages({ message: "hello" });
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].content, "hello");
  assert.doesNotMatch(messages[0].content, /turn_|trace_|provider health|userId|Date/);
  assert.match(messages[0].content, /files, parsers, algorithms/);
  assert.match(messages[0].content, /search is only one possible source/);
});

test("logger generates span ids and redacts request bodies", () => {
  const events = [];
  const logger = createLogger({ sink: (event) => events.push(event) });
  logger.event("provider.request", {
    traceId: "trace_test",
    body: { messages: [{ role: "user", content: "secret text" }] },
    headers: { Authorization: "Bearer secret" }
  });

  assert.match(events[0].spanId, /^span_/);
  assert.equal(events[0].headers.Authorization, "[redacted]");
  assert.equal(events[0].body, undefined);
  assert.match(events[0].bodyPreview, /secret text/);
});

test("parser rejects malformed tool-call JSON with a stackful error", () => {
  assert.throws(
    () => parseToolCalls({
      tool_calls: [{
        id: "call_bad",
        function: { name: "read", arguments: "{" }
      }]
    }),
    (error) => {
      assert.equal(error.code, "TOOL_ARGUMENT_JSON_INVALID");
      assert.match(error.stack, /ToolExecutionError/);
      return true;
    }
  );
});

test("agent loop executes a tool, appends tool result, then returns final content", async () => {
  const { root, registry } = await registryFixture();
  await fs.writeFile(path.join(root, "note.txt"), "tool result", "utf8");
  const providerCalls = [];
  const provider = scriptedProvider([
    response({ tool_calls: [toolCall({ args: { path: "note.txt" } })] }, "resp_tools"),
    response({ content: "I read the file." }, "resp_final")
  ], providerCalls);
  const logs = [];

  const result = await runAgentTurn({
    message: "read note",
    provider,
    registry,
    logger: { event: (name, fields) => logs.push({ name, fields }) }
  });

  assert.equal(result.ok, true);
  assert.equal(result.answer, "I read the file.");
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.metadata.promptVersion, OBA_PROMPT_VERSION);
  assert.equal(result.metadata.toolSchemaVersion, OBA_TOOL_SCHEMA_VERSION);
  assert.equal(providerCalls.length, 2);
  assert.equal(providerCalls[0].tools.length, 7);
  assert.equal(providerCalls[1].messages.at(-1).role, "tool");
  assert.ok(logs.some((entry) => entry.name === "tool.call.success"));
  assert.ok(logs.some((entry) => entry.name === "final.claim_check"));
  const providerLog = logs.find((entry) => entry.name === "provider.request");
  const toolLog = logs.find((entry) => entry.name === "tool.call.start");
  assert.match(providerLog.fields.traceId, /^trace_/);
  assert.match(providerLog.fields.spanId, /^span_/);
  assert.equal(toolLog.fields.traceId, providerLog.fields.traceId);
  assert.equal(toolLog.fields.parentSpanId, providerLog.fields.spanId);
});

test("agent loop attaches ggui surfaces returned by tool calls", async () => {
  const { registry } = await registryFixture({ fetchImpl: commonsFetchFixture() });
  const providerCalls = [];
  const provider = scriptedProvider([
    response({
      tool_calls: [toolCall({
        id: "call_surface",
        name: "ggui_render_surface",
        args: {
          type: "image.gallery",
          payload: {
            title: "Actual restaurant photos",
            images: [{
              url: "https://upload.wikimedia.org/wikipedia/commons/example/Restaurant.jpg",
              caption: "Restaurant interior",
              source: "https://commons.wikimedia.org/wiki/File:Restaurant.jpg"
            }]
          }
        }
      })]
    }, "resp_photo_tool"),
    response({ content: "사진 결과를 첨부했습니다." }, "resp_photo_final")
  ], providerCalls);

  const result = await runAgentTurn({
    message: "이 식당 리뷰 사진 보여줘",
    provider,
    registry,
    logger: { event: () => {} }
  });

  assert.equal(result.answer, "사진 결과를 첨부했습니다.");
  assert.equal(result.toolCalls[0].name, "ggui_render_surface");
  assert.equal(result.toolCalls[0].status, "success");
  assert.equal(result.metadata.attachments.surfaces.length, 1);
  assert.equal(result.metadata.attachments.surfaces[0].kind, "imageGallery");
  assert.equal(result.metadata.attachments.surfaces[0].images[0].source, "https://commons.wikimedia.org/wiki/File:Restaurant.jpg");
  const toolResult = JSON.parse(providerCalls[1].messages.at(-1).content);
  assert.equal(toolResult.result.kind, "ggui.surface");
});

test("toolMode disabled sends no tools to the provider", async () => {
  const providerCalls = [];
  const provider = scriptedProvider([response({ content: "plain answer" })], providerCalls);
  const result = await runAgentTurn({
    message: "hello",
    toolMode: "disabled",
    provider,
    logger: { event: () => {} }
  });
  assert.equal(result.answer, "plain answer");
  assert.equal(Object.hasOwn(providerCalls[0], "tools"), false);
});

test("duplicate tool call ids do not execute twice", async () => {
  const registry = {
    specs: () => [{
      type: "function",
      function: { name: "count", description: "count", parameters: { type: "object" } }
    }],
    count: 0,
    async execute() {
      this.count += 1;
      return { count: this.count };
    }
  };
  const provider = scriptedProvider([
    response({ tool_calls: [toolCall({ id: "call_dup", name: "count", args: { value: 1 } })] }),
    response({ tool_calls: [toolCall({ id: "call_dup", name: "count", args: { value: 1 } })] }),
    response({ content: "completed" })
  ]);
  const logs = [];

  await runAgentTurn({
    message: "count once",
    provider,
    registry,
    logger: { event: (name, fields) => logs.push({ name, fields }) }
  });

  assert.equal(registry.count, 1);
  assert.ok(logs.some((entry) => entry.name === "tool.call.duplicate"));
});

test("duplicate tool call ids with different args produce conflict result", async () => {
  const registry = {
    specs: () => [{
      type: "function",
      function: { name: "count", description: "count", parameters: { type: "object" } }
    }],
    count: 0,
    async execute() {
      this.count += 1;
      return { count: this.count };
    }
  };
  const providerCalls = [];
  const provider = scriptedProvider([
    response({ tool_calls: [toolCall({ id: "call_dup", name: "count", args: { value: 1 } })] }),
    response({ tool_calls: [toolCall({ id: "call_dup", name: "count", args: { value: 2 } })] }),
    response({ content: "completed" })
  ], providerCalls);

  await runAgentTurn({
    message: "count conflict",
    provider,
    registry,
    logger: { event: () => {} }
  });

  assert.equal(registry.count, 1);
  const conflictMessage = JSON.parse(providerCalls[2].messages.at(-1).content);
  assert.equal(conflictMessage.code, "TOOL_CALL_CONFLICT");
});

test("agent loop stops at max provider calls", async () => {
  const provider = scriptedProvider([
    response({ tool_calls: [toolCall({ name: "missing", args: {} })] }),
    response({ tool_calls: [toolCall({ id: "call_2", name: "missing", args: {} })] })
  ]);

  await assert.rejects(
    () => runAgentTurn({
      message: "loop",
      provider,
      maxProviderCalls: 2,
      logger: { event: () => {} }
    }),
    (error) => {
      assert.equal(error.code, "MAX_TOOL_ITERATIONS");
      return true;
    }
  );
});

test("provider errors have distinct provider error code", async () => {
  const provider = scriptedProvider([new Error("provider down")]);
  await assert.rejects(
    () => runAgentTurn({ message: "hello", provider, logger: { event: () => {} } }),
    (error) => {
      assert.equal(error.code, "PROVIDER_REQUEST_FAILED");
      assert.match(error.stack, /ToolExecutionError/);
      return true;
    }
  );
});

test("tool errors remain tool failures and are returned to the model", async () => {
  const providerCalls = [];
  const provider = scriptedProvider([
    response({ tool_calls: [toolCall({ name: "missing", args: {} })] }),
    response({ content: "I cannot complete that." })
  ], providerCalls);
  const logs = [];

  const result = await runAgentTurn({
    message: "call missing tool",
    provider,
    logger: { event: (name, fields) => logs.push({ name, fields }) }
  });

  assert.equal(result.toolCalls[0].code, "TOOL_NOT_FOUND");
  assert.ok(logs.some((entry) => entry.name === "tool.call.error"));
  const toolResult = JSON.parse(providerCalls[1].messages.at(-1).content);
  assert.equal(toolResult.error.code, "TOOL_NOT_FOUND");
});

test("claim check downgrades completion claims without tool evidence", async () => {
  const provider = scriptedProvider([response({ content: "I completed the edit." })]);
  const result = await runAgentTurn({
    message: "say done",
    provider,
    logger: { event: () => {} }
  });
  assert.equal(result.metadata.claimCheck.passed, false);
  assert.match(result.answer, /확인할 수 있는 도구 실행 기록/);
});

test("claim check does not downgrade capability explanations without tool evidence", async () => {
  const provider = scriptedProvider([response({
    content: "파일 확인은 가능합니다. read 도구를 사용해서 작업공간 안의 UTF-8 텍스트 파일을 읽을 수 있습니다."
  })]);
  const result = await runAgentTurn({
    message: "파일확인은?",
    provider,
    logger: { event: () => {} }
  });

  assert.equal(result.metadata.claimCheck.passed, true);
  assert.equal(result.metadata.claimCheck.downgraded, false);
  assert.match(result.answer, /파일 확인은 가능합니다/);
});
