import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runWorkflow } from "../src/workflows/runner.js";
import { validateWorkflowYaml } from "../src/workflows/validate.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

test("llm.prompt and llm.classify run through fake LM Studio", async () => {
  const port = await getFreePort();
  const child = spawn(process.execPath, [path.join(repoRoot, "scripts/qa/fake-lmstudio.mjs"), "--port", String(port)], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForServerReady(child, port);
    const workflow = validateWorkflowYaml(await workflowFixture("llm-prompt-classify.yml"), {
      filePath: "llm-prompt-classify.yml"
    });
    const result = await runWorkflow({
      workflow,
      input: {
        text: "회의 일정을 다음 주로 미루자고 제안하는 메시지야.",
        lmStudioBaseUrl: `http://127.0.0.1:${port}/v1`
      }
    });
    assert.match(result.outputs.response, /fake-lmstudio:/);
    assert.equal(result.outputs.label, "schedule_change");
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
    if (stderr.trim()) process.stderr.write(stderr);
  }
});

test("llm node rejects disallowed models before network", async () => {
  const workflow = validateWorkflowYaml(await workflowFixture("llm-model-disallowed.yml"), {
    filePath: "llm-model-disallowed.yml"
  });
  await assert.rejects(
    () => runWorkflow({
      workflow,
      input: {
        lmStudioBaseUrl: "http://127.0.0.1:65530/v1",
        llmModelAllowlist: "exaone-4.0-1.2b"
      }
    }),
    (error) => error.code === "LLM_MODEL_NOT_ALLOWED"
  );
});

async function workflowFixture(name) {
  return fs.readFile(path.join(repoRoot, "fixtures", "workflows", name), "utf8");
}

async function getFreePort() {
  const server = createServer();
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
    if (child.exitCode !== null) throw new Error(`fake LM Studio exited early: ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error("fake LM Studio did not become ready in time");
}

async function waitForExit(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => child.once("exit", resolve));
}
