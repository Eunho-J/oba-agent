import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
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

async function withServer(handler, deps = {}) {
  const providerCalls = [];
  const lmStudioCalls = [];
  const provider = {
    name: "scripted",
    async complete(request) {
      providerCalls.push(request);
      return {
        id: "resp_http",
        choices: [{ message: { content: "plain final" } }]
      };
    }
  };
  const lmStudioClient = {
    name: "lmstudio-exaone",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete(request) {
      lmStudioCalls.push(request);
      const feature = request?.metadata?.feature;
      if (feature === "exaone.input_translation") {
        const rawUser = extractTaggedBlock(request.messages.at(-1).content, "user");
        return {
          id: "resp_exaone_input",
          model: "exaone-4.0-1.2b",
          choices: [{ message: { content: `[agent]${rawUser} (translated)[/agent]` } }]
        };
      }
      if (feature !== "exaone.final_answer") {
        throw new Error(`unexpected EXAONE feature: ${String(feature)}`);
      }
      const mainAnswer = extractTaggedBlock(request.messages.at(-1).content, "agent");
      return {
        id: "resp_exaone_final",
        model: "exaone-4.0-1.2b",
        choices: [{ message: { content: `exaone final: ${mainAnswer}` } }]
      };
    }
  };
  const server = createServer({ enableAgentTurnAlias: true, mcpServers: {} }, {
    provider,
    lmStudioClient,
    logger: { event: () => {} },
    fetch: deps.fetch
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await handler(`http://127.0.0.1:${port}`, providerCalls, lmStudioCalls);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function postRaw(baseUrl, path, raw) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw
  });
  return { status: response.status, body: await response.json() };
}

function commonsFetchFixture() {
  return async () => jsonResponse({
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
  });
}

function webSearchFetchFixture() {
  return async (url) => {
    assert.match(String(url), /duckduckgo\.com/);
    return {
      ok: true,
      status: 200,
      async text() {
        return [
          '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fopenai">OpenAI result</a>',
          '<a class="result__snippet">OpenAI search summary.</a>',
          '<a class="result__a" href="https://example.org/ai">AI result</a>',
          '<div class="result__snippet">AI search summary.</div>'
        ].join("\n");
      }
    };
  };
}

function toolCall({ id = "call_1", name, args = {} }) {
  return {
    id,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args)
    }
  };
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    }
  };
}

test("GET /health remains available", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("POST /turn returns EXAONE final answer with main-agent metadata", async () => {
  await withServer(async (baseUrl, providerCalls, lmStudioCalls) => {
    const response = await postJson(baseUrl, "/turn", { message: "hello", metadata: { hidden: "value" } });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.match(response.body.answer, /^exaone final:/);
    assert.match(response.body.answer, /plain final/);
    assert.equal(response.body.metadata.mainAgentAnswer, "plain final");
    assert.equal(response.body.metadata.mainAgentInput, "hello (translated)");
    assert.equal(response.body.metadata.originalUserMessage, "hello");
    assert.equal(response.body.metadata.finalAnswerProvider, "lmstudio-exaone");
    assert.equal(response.body.metadata.finalAnswerModel, "exaone-4.0-1.2b");
    assert.equal(response.body.metadata.finalAnswerMode, "exaone.final");
    assert.equal(response.body.metadata.inputTranslationMode, "exaone.input_translation");
    assert.equal(response.body.surface, undefined);
    assert.equal(response.body.plan, undefined);
    assert.equal(response.body.result, undefined);
    assert.equal(providerCalls.length, 1);
    assert.equal(lmStudioCalls.length, 2);
    assert.equal(providerCalls[0].messages[1].content, "hello (translated)");
    const inputTranslationCall = findFeatureCall(lmStudioCalls, "exaone.input_translation");
    const finalAnswerCall = findFeatureCall(lmStudioCalls, "exaone.final_answer");
    assert.ok(inputTranslationCall);
    assert.ok(finalAnswerCall);
    assert.match(inputTranslationCall.messages.at(-1).content, /\[user\]\s*hello\s*\[\/user\]/);
    assert.match(finalAnswerCall.messages.at(-1).content, /\[user\]\s*hello\s*\[\/user\]/);
    assert.match(finalAnswerCall.messages.at(-1).content, /\[agent\]\s*plain final\s*\[\/agent\]/);
  });
});

test("POST /turn attaches ordered inline ggui surfaces returned by main-agent tool calls", async () => {
  const providerCalls = [];
  const lmStudioCalls = [];
  const provider = {
    name: "scripted",
    async complete(request) {
      providerCalls.push(request);
      if (providerCalls.length === 1) {
        return {
          id: "resp_search_tool",
          choices: [{
            message: {
              tool_calls: [toolCall({
                id: "call_photo_search",
                name: "search_images",
                args: {
                  query: "workspace reference diagram",
                  limit: 2
                }
              })]
            }
          }]
        };
      }
      if (providerCalls.length === 2) {
        return {
          id: "resp_surface_tool",
          choices: [{
            message: {
              tool_calls: [toolCall({
                id: "call_surface_render",
                name: "ggui_render_surface",
                args: {
                  type: "comparison.table",
                  payload: {
                    title: "Workspace options",
                    columns: [{ key: "name", label: "Name" }, { key: "score", label: "Score" }],
                    items: [{ name: "alpha", score: 91 }]
                  }
                }
              }), toolCall({
                id: "call_surface_render_gallery",
                name: "ggui_render_surface",
                args: {
                  type: "image.gallery",
                  payload: {
                    title: "Reference images",
                    sourceUrl: "https://commons.wikimedia.org/wiki/Special:MediaSearch?search=workspace+reference+diagram&type=image",
                    images: [{
                      url: "https://upload.wikimedia.org/wikipedia/commons/example/Reference.jpg",
                      caption: "Reference diagram",
                      source: "https://commons.wikimedia.org/wiki/File:Reference.jpg"
                    }]
                  }
                }
              })]
            }
          }]
        };
      }
      return {
        id: "resp_photo_final",
        choices: [{ message: { content: "MAIN_SENTINEL: attached generic surfaces." } }]
      };
    }
  };
  const lmStudioClient = {
    name: "lmstudio-exaone",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete(request) {
      lmStudioCalls.push(request);
      return {
        id: "resp_exaone_surfaces",
        model: "exaone-4.0-1.2b",
        choices: [{ message: { content: "EXAONE final with attached generic surfaces." } }]
      };
    }
  };
  const server = createServer({ mcpServers: {} }, {
    provider,
    lmStudioClient,
    logger: { event: () => {} },
    fetch: commonsFetchFixture()
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "show two generic surfaces" });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.answer, "EXAONE final with attached generic surfaces.");
    assert.equal(response.body.gguiAttachments.length, 2);
    assert.equal(response.body.gguiAttachments[0].kind, "comparisonTable");
    assert.equal(response.body.gguiAttachments[1].kind, "imageGallery");
    assert.deepEqual(response.body.surface, response.body.gguiAttachments[0]);
    assert.equal(response.body.metadata.ggui.mode, "inline");
    assert.equal(response.body.metadata.ggui.count, 2);
    assert.deepEqual(response.body.metadata.ggui.types, ["comparison.table", "image.gallery"]);
    assert.equal(response.body.metadata.attachments.surfaces[0].kind, "comparisonTable");
    assert.equal(response.body.metadata.debug.mainAgent.toolCalls[0].name, "search_images");
    assert.equal(response.body.metadata.debug.mainAgent.toolCalls[0].status, "success");
    assert.equal(response.body.metadata.debug.mainAgent.toolCalls[1].name, "ggui_render_surface");
    assert.equal(response.body.metadata.debug.mainAgent.toolCalls[1].status, "success");
    const finalAnswerCall = findFeatureCall(lmStudioCalls, "exaone.final_answer");
    assert.ok(finalAnswerCall);
    assert.match(finalAnswerCall.messages.at(-1).content, /MAIN_SENTINEL/);
    assert.equal(providerCalls.length, 3);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /turn can attach ggui from non-search data sources", async () => {
  const providerCalls = [];
  const lmStudioCalls = [];
  const workspaceRoot = process.cwd();
  const dataPath = path.join(workspaceRoot, "tmp", "ggui-non-search-data.json");
  const userMessage = "로컬 파일을 읽어서 비교 표 UI로 붙여줘";
  assert.doesNotMatch(userMessage, /ggui/i);
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify({
    items: [
      { name: "alpha", score: 91 },
      { name: "beta", score: 88 }
    ]
  }), "utf8");
  const provider = {
    name: "scripted",
    async complete(request) {
      providerCalls.push(request);
      if (providerCalls.length === 1) {
        return {
          id: "resp_read_source",
          choices: [{
            message: {
              tool_calls: [toolCall({
                id: "call_read_table_source",
                name: "read",
                args: { path: "tmp/ggui-non-search-data.json" }
              })]
            }
          }]
        };
      }
      if (providerCalls.length === 2) {
        return {
          id: "resp_render_table",
          choices: [{
            message: {
              tool_calls: [toolCall({
                id: "call_render_table",
                name: "ggui_render_surface",
                args: {
                  type: "comparison.table",
                  payload: {
                    title: "Parsed local data",
                    columns: [{ key: "name", label: "Name" }, { key: "score", label: "Score" }],
                    items: [{ name: "alpha", score: 91 }, { name: "beta", score: 88 }]
                  }
                }
              })]
            }
          }]
        };
      }
      return {
        id: "resp_non_search_final",
        choices: [{ message: { content: "MAIN_SENTINEL: rendered parsed local data." } }]
      };
    }
  };
  const lmStudioClient = {
    name: "lmstudio-exaone",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete(request) {
      lmStudioCalls.push(request);
      if (request?.metadata?.feature === "exaone.input_translation") {
        const rawUser = extractTaggedBlock(request.messages.at(-1).content, "user");
        return {
          id: "resp_exaone_non_search_input",
          model: "exaone-4.0-1.2b",
          choices: [{ message: { content: `[agent]${rawUser}[/agent]` } }]
        };
      }
      return {
        id: "resp_exaone_non_search",
        model: "exaone-4.0-1.2b",
        choices: [{ message: { content: "EXAONE final with parsed local table." } }]
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
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", {
      message: userMessage
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "EXAONE final with parsed local table.");
    assert.equal(response.body.metadata.originalUserMessage, userMessage);
    assert.equal(response.body.metadata.mainAgentInput, userMessage);
    assert.equal(response.body.gguiAttachments.length, 1);
    assert.equal(response.body.surface.kind, "comparisonTable");
    assert.deepEqual(response.body.surface, response.body.gguiAttachments[0]);
    assert.equal(response.body.surface.type, "comparison.table");
    assert.equal(response.body.surface.title, "Parsed local data");
    assert.equal(response.body.surface.items[0].name, "alpha");
    assert.equal(response.body.metadata.debug.mainAgent.toolCalls.map((call) => call.name).join(","), "read,ggui_render_surface");
    assert.equal(response.body.metadata.debug.mainAgent.toolCalls.some((call) => call.name === "search_images"), false);
    const finalAnswerCall = findFeatureCall(lmStudioCalls, "exaone.final_answer");
    assert.ok(finalAnswerCall);
    assert.match(finalAnswerCall.messages.at(-1).content, /MAIN_SENTINEL/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dataPath, { force: true });
  }
});

test("POST /turn can organize web_search results with ggui without user naming ggui", async () => {
  const providerCalls = [];
  const lmStudioCalls = [];
  const userMessage = "최신 AI 소식 몇 개 찾아서 보기 좋게 정리해줘";
  assert.doesNotMatch(userMessage, /ggui/i);
  const provider = {
    name: "scripted",
    async complete(request) {
      providerCalls.push(request);
      if (providerCalls.length === 1) {
        return {
          id: "resp_web_search",
          choices: [{
            message: {
              tool_calls: [toolCall({
                id: "call_web_search",
                name: "web_search",
                args: {
                  query: "latest AI news",
                  limit: 2
                }
              })]
            }
          }]
        };
      }
      if (providerCalls.length === 2) {
        return {
          id: "resp_web_surface",
          choices: [{
            message: {
              tool_calls: [toolCall({
                id: "call_web_surface",
                name: "ggui_render_surface",
                args: {
                  type: "comparison.table",
                  payload: {
                    title: "Latest AI links",
                    columns: [
                      { key: "title", label: "Title" },
                      { key: "source", label: "Source" }
                    ],
                    items: [
                      { title: "OpenAI result", source: "https://example.com/openai" },
                      { title: "AI result", source: "https://example.org/ai" }
                    ]
                  }
                }
              })]
            }
          }]
        };
      }
      return {
        id: "resp_web_final",
        choices: [{ message: { content: "MAIN_SENTINEL: web results organized." } }]
      };
    }
  };
  const lmStudioClient = {
    name: "lmstudio-exaone",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete(request) {
      lmStudioCalls.push(request);
      if (request?.metadata?.feature === "exaone.input_translation") {
        return {
          id: "resp_exaone_web_input",
          model: "exaone-4.0-1.2b",
          choices: [{ message: { content: `[agent]${extractTaggedBlock(request.messages.at(-1).content, "user")}[/agent]` } }]
        };
      }
      return {
        id: "resp_exaone_web_final",
        model: "exaone-4.0-1.2b",
        choices: [{ message: { content: "EXAONE final with web table." } }]
      };
    }
  };
  const server = createServer({ mcpServers: {} }, {
    provider,
    lmStudioClient,
    logger: { event: () => {} },
    fetch: webSearchFetchFixture()
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: userMessage });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "EXAONE final with web table.");
    assert.equal(response.body.metadata.originalUserMessage, userMessage);
    assert.equal(response.body.metadata.debug.mainAgent.toolCalls.map((call) => call.name).join(","), "web_search,ggui_render_surface");
    assert.equal(response.body.metadata.debug.mainAgent.toolCalls[0].result.result.results.length, 2);
    assert.equal(response.body.gguiAttachments.length, 1);
    assert.equal(response.body.surface.kind, "comparisonTable");
    assert.equal(response.body.surface.items[0].title, "OpenAI result");
    assert.equal(response.body.surface.items[1].source, "https://example.org/ai");
    const finalAnswerCall = findFeatureCall(lmStudioCalls, "exaone.final_answer");
    assert.ok(finalAnswerCall);
    assert.match(finalAnswerCall.messages.at(-1).content, /MAIN_SENTINEL/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /turn does not heuristic-attach ggui surfaces without a tool call", async () => {
  await withServer(async (baseUrl, providerCalls) => {
    const response = await postJson(baseUrl, "/turn", { message: "plain text only" });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.deepEqual(response.body.gguiAttachments, []);
    assert.equal(response.body.surface, undefined);
    assert.deepEqual(response.body.metadata.attachments.surfaces, []);
    assert.equal(providerCalls.length, 1);
  }, { fetch: commonsFetchFixture() });
});

test("POST /ggui/image-search renders live-search payloads into image gallery surfaces", async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, "/ggui/image-search", {
      query: "restaurant food interior",
      title: "Actual restaurant photos",
      limit: 2
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.surface.kind, "imageGallery");
    assert.equal(response.body.surface.title, "Actual restaurant photos");
    assert.equal(response.body.surface.sourceUrl.includes("commons.wikimedia.org"), true);
    assert.equal(response.body.surface.images.length, 1);
    assert.equal(response.body.surface.images[0].caption, "Restaurant interior");
    assert.equal(response.body.surface.images[0].source, "https://commons.wikimedia.org/wiki/File:Restaurant.jpg");
  }, { fetch: commonsFetchFixture() });
});

test("POST /ggui/image-search fails actionably when search input is empty or result set is empty", async () => {
  await withServer(async (baseUrl) => {
    const missingQuery = await postJson(baseUrl, "/ggui/image-search", {});
    assert.equal(missingQuery.status, 400);
    assert.equal(missingQuery.body.error.code, "GGUI_IMAGE_SEARCH_QUERY_REQUIRED");

    const emptySearch = await postJson(baseUrl, "/ggui/image-search", { query: "no results" });
    assert.equal(emptySearch.status, 404);
    assert.equal(emptySearch.body.error.code, "GGUI_IMAGE_SEARCH_EMPTY");
  }, { fetch: async () => jsonResponse({ query: { pages: {} } }) });
});

test("POST /ggui/photo-search is not exposed", async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, "/ggui/photo-search", { query: "legacy route" });
    assert.equal(response.status, 404);
    assert.equal(response.body.error, "not_found");
  });
});

test("POST /turn debug metadata includes main-agent + EXAONE IO for successful read tool call", async () => {
  const providerCalls = [];
  const lmStudioCalls = [];
  const workspaceRoot = process.cwd();
  const readablePath = path.join(workspaceRoot, "tmp", "e2e-readable-note.txt");
  await fs.mkdir(path.dirname(readablePath), { recursive: true });
  await fs.writeFile(readablePath, "debug-readable-note", "utf8");

  const provider = {
    name: "scripted",
    async complete(request) {
      providerCalls.push(request);
      if (providerCalls.length === 1) {
        return {
          id: "resp_main_tools",
          choices: [{
            message: {
              tool_calls: [{
                id: "call_read_1",
                type: "function",
                function: {
                  name: "read",
                  arguments: JSON.stringify({ path: "tmp/e2e-readable-note.txt" })
                }
              }]
            }
          }]
        };
      }
      return {
        id: "resp_main_final",
        choices: [{ message: { content: "MAIN_SENTINEL: note inspection result prepared." } }]
      };
    }
  };
  const lmStudioClient = {
    name: "lmstudio-exaone",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete(request) {
      lmStudioCalls.push(request);
      if (request?.metadata?.feature === "exaone.input_translation") {
        return {
          id: "resp_exaone_input_debug",
          model: "exaone-4.0-1.2b",
          choices: [{ message: { content: "[agent]read file now[/agent]" } }]
        };
      }
      return {
        id: "resp_exaone_debug",
        model: "exaone-4.0-1.2b",
        choices: [{ message: { content: "EXAONE polished final response." } }]
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
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "read file now" });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "EXAONE polished final response.");
    assert.match(response.body.metadata.mainAgentAnswer, /MAIN_SENTINEL/);
    assert.equal(response.body.metadata.finalAnswerProvider, "lmstudio-exaone");

    const debug = response.body.metadata.debug;
    assert.ok(debug);
    assert.equal(debug.mainAgent.provider, "scripted");
    assert.equal(debug.mainAgent.toolCalls[0].name, "read");
    assert.equal(debug.mainAgent.toolCalls[0].status, "success");
    assert.equal(debug.mainAgent.toolCalls[0].result.ok, true);
    assert.equal(debug.mainAgent.toolCalls[0].result.result.path, "tmp/e2e-readable-note.txt");
    assert.equal(typeof debug.mainAgent.providerCalls[0].request.messages[0].content, "string");
    assert.match(debug.exaoneFinal.input.messages.at(-1).content, /MAIN_SENTINEL/);
    assert.equal(debug.exaoneFinal.output, "EXAONE polished final response.");
    assert.equal(debug.exaoneFinal.model, "exaone-4.0-1.2b");
    assert.match(debug.inputTranslation.rawOutput, /\[agent\]read file now\[\/agent\]/);
    assert.equal(lmStudioCalls.length, 2);
    assert.equal(providerCalls.length, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /turn debug metadata captures outside-root read errors without leaking file content", async () => {
  const provider = {
    name: "scripted",
    callCount: 0,
    async complete() {
      this.callCount += 1;
      if (this.callCount === 1) {
        return {
          id: "resp_main_outside_tools",
          choices: [{
            message: {
              tool_calls: [{
                id: "call_outside_read",
                type: "function",
                function: {
                  name: "read",
                  arguments: JSON.stringify({ path: "../outside.txt" })
                }
              }]
            }
          }]
        };
      }
      return {
        id: "resp_main_after_error",
        choices: [{ message: { content: "MAIN_SENTINEL_OUTSIDE: blocked." } }]
      };
    }
  };
  const lmStudioClient = {
    name: "lmstudio-exaone",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete() {
      return {
        id: "resp_exaone_outside",
        model: "exaone-4.0-1.2b",
        choices: [{ message: { content: "EXAONE final after blocked read." } }]
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
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "try outside read" });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "EXAONE final after blocked read.");
    const debug = response.body.metadata.debug;
    assert.ok(debug);
    assert.equal(debug.mainAgent.toolCalls[0].name, "read");
    assert.equal(debug.mainAgent.toolCalls[0].status, "error");
    assert.match(debug.mainAgent.toolCalls[0].code, /WORKSPACE|TOOL_/);
    assert.equal(debug.mainAgent.toolCalls[0].result.ok, false);
    assert.equal(typeof debug.mainAgent.toolCalls[0].result.error?.message, "string");
    assert.equal(debug.mainAgent.toolCalls[0].result.result, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /turn rejects malformed bodies and legacy transcript/audio fields", async () => {
  await withServer(async (baseUrl, providerCalls) => {
    for (const body of [
      {},
      null,
      "hello",
      42,
      [],
      { transcript: "old" },
      { audioText: "old" },
      { message: "hello", turn: { transcript: "old" } },
      { message: "hello", turn: { transcript: "" } },
      { message: "hello", turn: { transcript: null } }
    ]) {
      const response = await postJson(baseUrl, "/turn", body);
      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, "VALIDATION_ERROR");
      assert.match(response.body.error.stack, /Error/);
    }

    const malformed = await postRaw(baseUrl, "/turn", "{not json");
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, "VALIDATION_ERROR");
    assert.match(malformed.body.error.stack, /Error/);
    assert.equal(providerCalls.length, 0);
  });
});

test("POST /turn with toolMode disabled sends no tools to provider", async () => {
  await withServer(async (baseUrl, providerCalls) => {
    const response = await postJson(baseUrl, "/turn", { message: "hello", toolMode: "disabled" });
    assert.equal(response.status, 200);
    assert.equal(Object.hasOwn(providerCalls[0], "tools"), false);
  });
});

test("POST /turn reports hook and codex implementer failures as diagnostics", async () => {
  const provider = {
    name: "scripted",
    async complete() {
      return { id: "resp_hook_main", choices: [{ message: { content: "main answer" } }] };
    }
  };
  const lmStudioClient = {
    name: "lmstudio-exaone",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete() {
      return {
        id: "resp_hook_exaone",
        model: "exaone-4.0-1.2b",
        choices: [{ message: { content: "exaone answer despite diagnostics" } }]
      };
    }
  };
  const hookRunner = {
    async run() {
      throw new Error("throwing diagnostic hook");
    }
  };
  const server = createServer({
    mcpServers: {},
    selfImprovement: {
      codexImplementer: {
        enabled: true,
        healthUrl: "http://127.0.0.1:65530/health",
        timeoutMs: 25,
        role: "isolated-implementer",
        runtime: false
      }
    }
  }, {
    provider,
    lmStudioClient,
    hookRunner,
    fetch: async () => {
      const error = new Error("codex implementer unavailable");
      error.code = "ECONNREFUSED";
      throw error;
    },
    logger: { event: () => {} }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "self improve safely" });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "exaone answer despite diagnostics");
    assert.equal(response.body.metadata.debug.hooks[0].type, "hook.error");
    assert.equal(response.body.metadata.debug.hooks[0].status, "diagnostic");
    assert.match(response.body.metadata.debug.hooks[0].error.message, /throwing diagnostic hook/);
    assert.equal(response.body.metadata.debug.selfImprovement.codexImplementer.runtime, false);
    assert.equal(response.body.metadata.debug.selfImprovement.codexImplementer.role, "isolated-implementer");
    assert.equal(response.body.metadata.debug.selfImprovement.codexImplementer.available, false);
    assert.equal(response.body.metadata.debug.selfImprovement.codexImplementer.error.code, "ECONNREFUSED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /agent/turn delegates to the same engine handler", async () => {
  await withServer(async (baseUrl, providerCalls, lmStudioCalls) => {
    const response = await postJson(baseUrl, "/agent/turn", { message: "hello alias" });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.match(response.body.answer, /^exaone final:/);
    assert.equal(providerCalls[0].messages[1].content, "hello alias (translated)");
    const finalAnswerCall = findFeatureCall(lmStudioCalls, "exaone.final_answer");
    assert.ok(finalAnswerCall);
    assert.match(finalAnswerCall.messages.at(-1).content, /\[agent\]\s*plain final\s*\[\/agent\]/);
  });
});

test("POST /agent/turn is unavailable unless alias is explicitly enabled", async () => {
  const provider = {
    name: "scripted",
    async complete() {
      return { id: "resp_http", choices: [{ message: { content: "plain final" } }] };
    }
  };
  const server = createServer({ mcpServers: {} }, { provider, logger: { event: () => {} } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/agent/turn", { message: "hello" });
    assert.equal(response.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /voice/transcribe accepts audio paths through a whisper.cpp-compatible transcriber", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oba-voice-test-"));
  const audioPath = path.join(tempDir, "sample.wav");
  await fs.writeFile(audioPath, Buffer.from("RIFF....WAVEfmt "), "binary");
  const transcriberCalls = [];
  const server = createServer({ mcpServers: {}, voice: { uploadMaxBytes: 1024 } }, {
    voiceTranscriber: async (upload, config) => {
      transcriberCalls.push({ upload, config });
      return {
        ok: true,
        text: "안녕 OBA voice sample",
        provider: "whisper.cpp",
        command: { binary: "deterministic-whisper", args: ["-f", upload.path] },
        audio: { path: upload.path }
      };
    },
    logger: { event: () => {} }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/voice/transcribe", {
      audioPath,
      contentType: "audio/wav"
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.text, "안녕 OBA voice sample");
    assert.equal(response.body.provider, "whisper.cpp");
    assert.equal(transcriberCalls[0].upload.path, audioPath);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("POST /voice/transcribe converts browser webm uploads before whisper.cpp", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oba-voice-webm-test-"));
  const ffmpegArgsPath = path.join(tempDir, "ffmpeg-args.txt");
  const whisperArgsPath = path.join(tempDir, "whisper-args.txt");
  const fakeFfmpeg = path.join(tempDir, "fake-ffmpeg");
  const fakeWhisper = path.join(tempDir, "fake-whisper");
  await fs.writeFile(fakeFfmpeg, [
    "#!/bin/sh",
    "for last do :; done",
    `printf '%s\\n' \"$@\" > ${JSON.stringify(ffmpegArgsPath)}`,
    "printf 'RIFF....WAVEfmt ' > \"$last\""
  ].join("\n"), { mode: 0o755 });
  await fs.writeFile(fakeWhisper, [
    "#!/bin/sh",
    `printf '%s\\n' \"$@\" > ${JSON.stringify(whisperArgsPath)}`,
    "printf '[00:00.000 --> 00:01.000] browser voice\\n'"
  ].join("\n"), { mode: 0o755 });
  const server = createServer({
    mcpServers: {},
    voice: {
      uploadMaxBytes: 1024,
      ffmpegBin: fakeFfmpeg,
      whisperBin: fakeWhisper,
      whisperModel: "model.bin"
    }
  }, { logger: { event: () => {} } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const formData = new FormData();
    formData.append("audio", new Blob([Buffer.from("webm audio")], { type: "audio/webm" }), "microphone.webm");
    const rawResponse = await fetch(`http://127.0.0.1:${port}/voice/transcribe`, {
      method: "POST",
      body: formData
    });
    const response = { status: rawResponse.status, body: await rawResponse.json() };
    assert.equal(response.status, 200);
    assert.equal(response.body.text, "browser voice");
    assert.equal(response.body.audio.filename, "microphone.wav");
    assert.equal(response.body.audio.contentType, "audio/wav");
    assert.equal(response.body.audio.source.filename, "microphone.webm");

    const ffmpegArgs = await fs.readFile(ffmpegArgsPath, "utf8");
    assert.match(ffmpegArgs, /microphone\.webm/);
    assert.match(ffmpegArgs, /microphone\.wav/);
    const whisperArgs = await fs.readFile(whisperArgsPath, "utf8");
    assert.match(whisperArgs, /model\.bin/);
    assert.match(whisperArgs, /microphone\.wav/);
    assert.doesNotMatch(whisperArgs, /microphone\.webm/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("POST /voice/transcribe rejects malformed non-audio uploads actionably", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oba-voice-bad-test-"));
  const textPath = path.join(tempDir, "not-audio.txt");
  await fs.writeFile(textPath, "not audio", "utf8");
  const server = createServer({ mcpServers: {}, voice: { uploadMaxBytes: 1024 } }, {
    voiceTranscriber: async () => {
      throw new Error("transcriber should not be called");
    },
    logger: { event: () => {} }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/voice/transcribe", {
      audioPath: textPath,
      contentType: "text/plain"
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VOICE_UPLOAD_NOT_AUDIO");
    assert.match(response.body.error.message, /audio file/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("self-improvement endpoints stage candidates and smoke publish rollback registry state", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "oba-self-improvement-test-"));
  await fs.cp(path.join(process.cwd(), "fixtures"), path.join(workspaceRoot, "fixtures"), { recursive: true });
  const server = createServer({ mcpServers: {} }, {
    workspace: { root: workspaceRoot },
    logger: { event: () => {} }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const candidateResponse = await postJson(`http://127.0.0.1:${port}`, "/self-improvement/candidates", {
      workflowPath: "fixtures/workflows/evolution-candidates.yml",
      runId: "http-test"
    });
    assert.equal(candidateResponse.status, 200);
    assert.equal(candidateResponse.body.ok, true);
    assert.deepEqual(
      candidateResponse.body.artifacts.map((artifact) => artifact.element).sort(),
      [
        "codex-hook",
        "codex-skill",
        "exaone-system-prompt",
        "main-agent-system-prompt",
        "workflow-node-registry"
      ]
    );
    for (const artifact of candidateResponse.body.artifacts) {
      const artifactPath = path.join(workspaceRoot, ".oppa", "self-improvement", "candidates", "http-test", `${artifact.element}.json`);
      const parsed = JSON.parse(await fs.readFile(artifactPath, "utf8"));
      assert.equal(parsed.status, "candidate");
      assert.equal(parsed.element, artifact.element);
      assert.ok(parsed.provenance.workflowId);
      assert.equal(parsed.before, null);
      assert.ok(parsed.after);
    }

    const registryResponse = await postJson(`http://127.0.0.1:${port}`, "/self-improvement/registry-smoke", {
      seedId: "self_improvement_seed",
      candidateId: "self_improvement_next"
    });
    assert.equal(registryResponse.status, 200);
    assert.equal(registryResponse.body.before.id, "self_improvement_seed");
    assert.equal(registryResponse.body.afterPublish.id, "self_improvement_next");
    assert.equal(registryResponse.body.afterRollback.id, "self_improvement_seed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("configured MCP tools are discovered before /turn provider request", async () => {
  const providerCalls = [];
  const provider = {
    name: "scripted",
    async complete(request) {
      providerCalls.push(request);
      return { id: "resp_http", choices: [{ message: { content: "plain final" } }] };
    }
  };
  const client = {
    async listTools() {
      return {
        tools: [{
          name: "lookup",
          description: "Lookup data",
          inputSchema: { type: "object", properties: {} }
        }]
      };
    },
    async callTool() {
      return { content: [{ type: "text", text: "ok" }] };
    },
    async close() {}
  };
  const server = createServer({
    mcpServers: {
      apifuse: {
        transport: "streamable-http",
        url: "https://example.com/mcp",
        enabledTools: ["lookup"],
        toolPolicies: { lookup: { risk: "read-only" } }
      }
    }
  }, {
    provider,
    lmStudioClient: {
      name: "lmstudio-exaone",
      model: "exaone-4.0-1.2b",
      baseUrl: "http://127.0.0.1:1234/v1",
      async complete() {
        return { choices: [{ message: { content: "exaone final" } }] };
      }
    },
    mcpClientFactory: async () => client,
    logger: { event: () => {} }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "hello" });
    assert.equal(response.status, 200);
    assert.ok(providerCalls[0].tools.some((tool) => tool.function.name === "apifuse.lookup"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /turn fails actionably when EXAONE final answer generation fails", async () => {
  const provider = {
    name: "scripted",
    async complete() {
      return { id: "resp_http", choices: [{ message: { content: "main answer" } }] };
    }
  };
  const lmStudioClient = {
    name: "lmstudio-exaone",
    model: "exaone-4.0-1.2b",
    baseUrl: "http://127.0.0.1:1234/v1",
    async complete() {
      const error = new Error("LM Studio request failed");
      error.code = "LLM_REQUEST_FAILED";
      error.status = 503;
      throw error;
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
    const response = await postJson(`http://127.0.0.1:${port}`, "/turn", { message: "hello" });
    assert.equal(response.status, 503);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error.code, "LLM_REQUEST_FAILED");
    assert.match(response.body.error.message, /LM Studio request failed/);
    assert.equal(response.body.answer, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("gateway responses include CORS headers and support OPTIONS preflight", async () => {
  await withServer(async (baseUrl) => {
    const preflight = await fetch(`${baseUrl}/ggui/render`, {
      method: "OPTIONS"
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
    assert.match(preflight.headers.get("access-control-allow-methods") || "", /OPTIONS/);

    const renderResponse = await postJson(baseUrl, "/ggui/render", {
      intent: {
        type: "imageGallery",
        payload: {
          title: "Sample",
          images: [{ url: "https://example.com/sample.jpg" }]
        }
      }
    });
    assert.equal(renderResponse.status, 200);
    assert.equal(renderResponse.body.ok, true);
  });
});
