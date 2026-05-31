import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "../src/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

test("POST /workflows/recall/run executes YAML recall workflow", async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, "/workflows/recall/run", {
      workflowPath: "fixtures/workflows/recall-gateway.yml",
      input: {
        query: "회의 sk-secretTOKEN123",
        vaultRoot: path.join(repoRoot, "fixtures", "vault", "basic-vault")
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.workflowId, "recall-gateway-v1");
    assert.match(response.body.outputs.response, /core-principles/);
    assert.match(response.body.outputs.response, /\[REDACTED\]/);
    assert.equal(response.body.outputs.candidate, undefined);
  });
});

test("POST /workflows/recall/run rejects unsafe or malformed workflow requests", async () => {
  await withServer(async (baseUrl) => {
    const missing = await postJson(baseUrl, "/workflows/recall/run", { input: {} });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.code, "VALIDATION_ERROR");

    const escaping = await postJson(baseUrl, "/workflows/recall/run", {
      workflowPath: "../secret.yml",
      input: {}
    });
    assert.equal(escaping.status, 400);
    assert.equal(escaping.body.error.code, "VALIDATION_ERROR");

    const invalidWorkflow = await postJson(baseUrl, "/workflows/recall/run", {
      workflowPath: "fixtures/workflows/ggui-render-node.yml",
      input: {}
    });
    assert.equal(invalidWorkflow.status, 400);
    assert.equal(invalidWorkflow.body.error.code, "WORKFLOW_VALIDATION_FAILED");
  });
});

test("GET /providers/health reports codex-as-api health and lmstudio reachability", async () => {
  const upstream = createHttpServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { status: "ok" });
    }
    if (req.method === "GET" && req.url === "/v1/models") {
      return sendJson(res, 200, {
        object: "list",
        data: [{ id: "exaone-4.0-1.2b", object: "model" }]
      });
    }
    return sendJson(res, 404, { error: "not_found" });
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const { port: upstreamPort } = upstream.address();
  const base = `http://127.0.0.1:${upstreamPort}/v1`;

  const server = createServer({
    mcpServers: {},
    provider: {
      name: "codex-as-api",
      baseUrl: base,
      apiKey: "unused",
      model: "gpt-5.5"
    },
    lmstudio: {
      baseUrl: base,
      apiKey: "lm-studio",
      model: "exaone-4.0-1.2b",
      requestTimeoutMs: 5000,
      maxTokensCap: 512,
      temperatureCap: 1,
      modelAllowlist: ["exaone-4.0-1.2b"]
    }
  }, {
    logger: { event: () => {} },
    workspace: { root: repoRoot }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/providers/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.providers.codexAsApi.name, "codex-as-api");
    assert.equal(body.providers.codexAsApi.reachable, true);
    assert.equal(body.providers.codexAsApi.status, 200);
    assert.equal(body.providers.codexAsApi.healthUrl, `http://127.0.0.1:${upstreamPort}/health`);
    assert.equal(body.providers.lmstudio.reachable, true);
    assert.equal(body.providers.lmstudio.status, 200);
    assert.equal(body.providers.lmstudio.modelsUrl, base + "/models");
    assert.equal(body.providers.lmstudio.modelCount, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => upstream.close(resolve));
  }
});

async function withServer(handler) {
  const server = createServer({ mcpServers: {} }, {
    provider: { async complete() { return { choices: [{ message: { content: "ok" } }] }; } },
    logger: { event: () => {} },
    workspace: { root: repoRoot }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await handler(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postJson(baseUrl, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
