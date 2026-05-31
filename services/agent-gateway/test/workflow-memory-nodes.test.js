import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { executeNode } from "../src/workflows/node-handlers.js";
import { runWorkflow } from "../src/workflows/runner.js";
import { validateWorkflowYaml } from "../src/workflows/validate.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const fixtureDir = path.join(repoRoot, "fixtures");

async function workflowFixture(name) {
  return fs.readFile(path.join(fixtureDir, "workflows", name), "utf8");
}

test("vault recall safety candidate workflow returns core memory and inert candidate", async () => {
  const workflow = validateWorkflowYaml(await workflowFixture("recall-safety-candidate.yml"), {
    filePath: "recall-safety-candidate.yml"
  });
  const result = await runWorkflow({
    workflow,
    input: {
      query: "회의 sk-secretTOKEN123",
      vaultRoot: path.join(fixtureDir, "vault", "basic-vault")
    }
  });

  assert.match(result.outputs.response, /core-principles/);
  assert.match(result.outputs.response, /\[REDACTED\]/);
  assert.equal(result.outputs.candidate.kind, "vaultPatch");
  assert.equal(result.outputs.candidate.status, "candidate");
});

test("safety.validateSchema rejects malformed objects", async () => {
  const workflow = validateWorkflowYaml(await workflowFixture("safety-schema-invalid.yml"), {
    filePath: "safety-schema-invalid.yml"
  });
  await assert.rejects(
    () => runWorkflow({ workflow, input: { object: { title: "Only title" } } }),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED" && error.message.includes("summary")
  );
});

test("vault nodes read, split, and require confirmation without publishing", async () => {
  const runtimeInput = { vaultRoot: path.join(fixtureDir, "vault", "basic-vault") };
  const read = await executeNode(
    node("vault.read", { path: "memory/core/core-principles.md" }, { note: {} }),
    { inputs: {}, runtimeInput }
  );
  const split = await executeNode(
    node("vault.splitCandidate", { path: "memory/core/core-principles.md" }, { candidate: {} }),
    { inputs: { markdown: await fs.readFile(path.join(fixtureDir, "vault", "oversized-core-note.md"), "utf8") }, runtimeInput }
  );
  const confirmation = await executeNode(
    node("safety.requireConfirmation", { message: "publish candidate?" }, { required: {}, message: {}, value: {} }),
    { inputs: { value: split.candidate }, runtimeInput }
  );

  assert.equal(read.note.frontmatter.id, "core-principles");
  assert.deepEqual(split.candidate.childIds, ["core-principles-part-1", "core-principles-part-2", "core-principles-part-3"]);
  assert.equal(confirmation.required, true);
});

function node(type, config, outputs) {
  return { id: `${type}-node`, type, config, outputs };
}
