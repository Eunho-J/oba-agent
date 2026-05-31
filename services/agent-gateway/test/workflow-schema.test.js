import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CATALOG_VERSION, MVP_NODE_TYPES, REJECTED_NODE_TYPES, catalogManifest } from "../src/workflows/catalog.js";
import { validateWorkflowYaml } from "../src/workflows/validate.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const fixtureDir = path.join(repoRoot, "fixtures", "workflows");

async function readFixture(name) {
  return fs.readFile(path.join(fixtureDir, name), "utf8");
}

async function assertWorkflowError(name, code) {
  await assert.rejects(
    async () => validateWorkflowYaml(await readFixture(name), { filePath: name }),
    (error) => error.code === code
  );
}

test("catalog manifest versions MVP and later-only node types", () => {
  const manifest = catalogManifest();
  assert.equal(manifest.catalogVersion, CATALOG_VERSION);
  assert.ok(MVP_NODE_TYPES.includes("output.uiIntent"));
  assert.ok(MVP_NODE_TYPES.includes("candidate.writeCodexDelegation"));
  assert.ok(!MVP_NODE_TYPES.includes("ggui.render"));
  assert.ok(REJECTED_NODE_TYPES.includes("loop.until"));
  assert.ok(!REJECTED_NODE_TYPES.includes("ggui.render"));
});

test("valid meeting recall workflow parses into stable JSON with catalogVersion", async () => {
  const workflow = validateWorkflowYaml(await readFixture("meeting-recall.yml"), {
    filePath: "meeting-recall.yml"
  });
  assert.equal(workflow.id, "meeting-recall-v1");
  assert.equal(workflow.catalogVersion, CATALOG_VERSION);
  assert.deepEqual(workflow.nodes.map((node) => node.type), [
    "input",
    "recall.seedCore",
    "flow.rank",
    "output.respond"
  ]);
});

test("missing or undeclared ports fail workflow validation", async () => {
  await assertWorkflowError("missing-port.yml", "WORKFLOW_VALIDATION_FAILED");
});

test("missing required inputs fail workflow validation", () => {
  const source = `
id: missing-required-input-v1
version: "1.0.0"
catalogVersion: ${CATALOG_VERSION}
nodes:
  - id: branch
    type: flow.branch
    config:
      condition: intent == 'meeting'
    inputs:
      value:
        type: string
        required: true
    outputs:
      matched:
        type: string
edges: []
outputs:
  matched:
    node: branch
    outputPort: matched
`;
  assert.throws(
    () => validateWorkflowYaml(source),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED"
  );
});

test("cycles outside bounded loop nodes fail workflow validation", async () => {
  await assertWorkflowError("cycle-no-loop.yml", "WORKFLOW_VALIDATION_FAILED");
});

test("ggui.render is rejected as a workflow node", async () => {
  await assertWorkflowError("ggui-render-node.yml", "WORKFLOW_VALIDATION_FAILED");
});

test("later-only loop.until is rejected as outside MVP", async () => {
  await assertWorkflowError("later-loop-until.yml", "WORKFLOW_NODE_NOT_IN_MVP");
});

test("unknown node config properties are rejected", () => {
  const source = `
id: invalid-config-v1
version: "1.0.0"
catalogVersion: ${CATALOG_VERSION}
nodes:
  - id: input
    type: input
    config:
      name: query
      arbitraryCode: nope
    outputs:
      value:
        type: string
edges: []
outputs:
  value:
    node: input
    outputPort: value
`;
  assert.throws(
    () => validateWorkflowYaml(source),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED"
  );
});
