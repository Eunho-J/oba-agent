import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer as createGatewayServer } from "../src/index.js";
import {
  createLmStudioClient,
  createRequestFromFixture
} from "../src/clients/exaone.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

test("disallowed model fixture fails with LLM_MODEL_NOT_ALLOWED before network", async () => {
  const fixture = await readFixture("disallowed-model.json");
  const request = createRequestFromFixture(fixture);
  const client = createLmStudioClient({
    baseUrl: "http://127.0.0.1:65530/v1",
    model: "exaone-4.0-1.2b",
    modelAllowlist: ["exaone-4.0-1.2b"]
  });

  await assert.rejects(
    () => client.complete(request),
    (error) => error?.code === "LLM_MODEL_NOT_ALLOWED"
  );
});

test("tool fields are rejected with LLM_TOOLS_NOT_ALLOWED", async () => {
  const fixture = await readFixture("tool-call-disallowed.json");
  const request = createRequestFromFixture(fixture);
  const client = createLmStudioClient({
    baseUrl: "http://127.0.0.1:65530/v1",
    model: "exaone-4.0-1.2b"
  });

  await assert.rejects(
    () => client.complete(request),
    (error) => error?.code === "LLM_TOOLS_NOT_ALLOWED"
  );
});

test("POST /exaone/express calls LM Studio chat completions and returns expressive text", async () => {
  const port = await getFreePort();
  const fakeServerPath = path.join(repoRoot, "scripts/qa/fake-lmstudio.mjs");
  const child = spawn(process.execPath, [fakeServerPath, "--port", String(port)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServerReady(child, port);
    const baseUrl = `http://127.0.0.1:${port}/v1`;
    const gateway = createGatewayServer({
      mcpServers: {},
      lmstudio: {
        baseUrl,
        apiKey: "lm-studio",
        model: "exaone-4.0-1.2b",
        requestTimeoutMs: 2000,
        maxTokensCap: 256,
        temperatureCap: 1,
        modelAllowlist: ["exaone-4.0-1.2b"]
      }
    }, {
      logger: { event: () => {} }
    });
    await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
    const { port: gatewayPort } = gateway.address();
    try {
      const response = await postJson(`http://127.0.0.1:${gatewayPort}`, "/exaone/express", {
        message: "오늘 일정 정리해줘"
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.provider, "lmstudio-exaone");
      assert.equal(response.body.baseUrl, baseUrl);
      assert.equal(response.body.model, "exaone-4.0-1.2b");
      assert.match(response.body.text, /^fake-lmstudio:/);
    } finally {
      await new Promise((resolve) => gateway.close(resolve));
    }
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
  }
});

test("POST /exaone/express validates request body and message", async () => {
  let callCount = 0;
  const gateway = createGatewayServer({ mcpServers: {} }, {
    provider: { async complete() { return { choices: [{ message: { content: "ok" } }] }; } },
    lmStudioClient: {
      name: "lmstudio-exaone",
      model: "model-a",
      baseUrl: "http://127.0.0.1:1234/v1",
      async complete() {
        callCount += 1;
        return { choices: [{ message: { content: "unused" } }] };
      }
    },
    logger: { event: () => {} }
  });
  await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  const { port } = gateway.address();

  try {
    for (const body of [{}, null, [], { message: "" }, { message: "   " }]) {
      const response = await postJson(`http://127.0.0.1:${port}`, "/exaone/express", body);
      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, "VALIDATION_ERROR");
    }
    assert.equal(callCount, 0);
  } finally {
    await new Promise((resolve) => gateway.close(resolve));
  }
});

test("POST /exaone/express returns actionable LLM request failure errors", async () => {
  const gateway = createGatewayServer({ mcpServers: {} }, {
    provider: { async complete() { return { choices: [{ message: { content: "ok" } }] }; } },
    lmStudioClient: {
      name: "lmstudio-exaone",
      model: "model-a",
      baseUrl: "http://127.0.0.1:1234/v1",
      async complete() {
        const error = new Error("LM Studio request failed");
        error.code = "LLM_REQUEST_FAILED";
        error.status = 503;
        error.data = { provider: "lmstudio" };
        throw error;
      }
    },
    logger: { event: () => {} }
  });
  await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  const { port } = gateway.address();

  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/exaone/express", {
      message: "표현을 다듬어줘"
    });
    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, "LLM_REQUEST_FAILED");
    assert.equal(response.body.error.data.provider, "lmstudio");
  } finally {
    await new Promise((resolve) => gateway.close(resolve));
  }
});

test("LM Studio smoke script works against deterministic local test server", async () => {
  const port = await getFreePort();
  const fakeServerPath = path.join(repoRoot, "scripts/qa/fake-lmstudio.mjs");
  const smokeScriptPath = path.join(repoRoot, "scripts/lmstudio-smoke.mjs");
  const promptFixturePath = path.join(repoRoot, "fixtures/llm/prompt.json");
  const classifyFixturePath = path.join(repoRoot, "fixtures/llm/classify.json");
  const child = spawn(process.execPath, [fakeServerPath, "--port", String(port)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForServerReady(child, port);

    const promptResult = await runSmoke(smokeScriptPath, promptFixturePath, port);
    assert.match(promptResult, /lmstudio-ok/);
    assert.match(promptResult, /mode=llm.prompt/);
    assert.match(promptResult, /content=fake-lmstudio:/);

    const classifyResult = await runSmoke(smokeScriptPath, classifyFixturePath, port);
    assert.match(classifyResult, /lmstudio-ok/);
    assert.match(classifyResult, /mode=llm.classify/);
    assert.match(classifyResult, /label=schedule_change/);
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
    if (stdout.trim()) {
      process.stdout.write(stdout);
    }
  }
});

async function readFixture(fileName) {
  const absolute = path.join(repoRoot, "fixtures/llm", fileName);
  return JSON.parse(await readFile(absolute, "utf8"));
}

async function getFreePort() {
  const server = createHttpServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForServerReady(child, port) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`fake LM Studio exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error("fake LM Studio did not become ready in time");
}

async function runSmoke(scriptPath, fixturePath, port) {
  const child = spawn(process.execPath, [scriptPath, fixturePath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OBA_LMSTUDIO_BASE_URL: `http://127.0.0.1:${port}/v1`,
      OBA_LLM_API_KEY: "lm-studio",
      OBA_LLM_MODEL: "exaone-4.0-1.2b",
      OBA_LLM_MODEL_ALLOWLIST: "exaone-4.0-1.2b"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  await waitForExit(child);
  if (child.exitCode !== 0) {
    throw new Error(`smoke script failed (${child.exitCode}): ${stderr || stdout}`);
  }
  return stdout.trim();
}

async function waitForExit(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => child.once("exit", resolve));
}

async function postJson(baseUrl, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
