import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { FileRegistry } from "../src/registry/file-registry.js";
import { runWorkflow } from "../src/workflows/runner.js";
import { validateWorkflowYaml } from "../src/workflows/validate.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

test("evolution candidate nodes stage internal inert proposals", async () => {
  const result = await runFixture("evolution-candidates.yml");
  assert.equal(result.outputs.nodeProposal.kind, "nodeProposal");
  assert.equal(result.outputs.systemPromptProposal.target, "obaMainAgent");
  assert.equal(result.outputs.exaoneSystemPromptProposal.target, "exaoneExpressionAgent");
  assert.equal(result.outputs.skillProposal.kind, "skillProposal");
  assert.equal(result.outputs.hookProposal.proposal.failurePolicy, "diagnostic");
  assert.equal(result.outputs.codexDelegation.proposal.codeLevelInstructions, undefined);
  for (const candidate of Object.values(result.outputs)) {
    assert.equal(candidate.status, "candidate");
  }
});

test("hook candidates must be failure-tolerant diagnostics", async () => {
  await assert.rejects(
    () => runFixture("hook-candidate-invalid.yml"),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED" && error.message.includes("failurePolicy")
  );
});

test("codex delegation candidates reject code-level instructions by default", async () => {
  await assert.rejects(
    () => runFixture("codex-delegation-invalid.yml"),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED" && error.message.includes("code-level")
  );
});

test("candidate publish and rollback nodes promote and restore active registry state", async () => {
  const registryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "oba-workflow-registry-"));
  const registry = new FileRegistry({ root: registryRoot });
  const baseCandidate = await readRegistryCandidateFixture("minimal-active.json");
  const activeCandidate = candidateWithId(baseCandidate, "candidate_active_seed", "purchase-confirmation-ui-seed-v1");
  const publishCandidate = candidateWithId(baseCandidate, "candidate_to_publish", "purchase-confirmation-ui-publish-v2");

  await registry.writeCandidate(activeCandidate);
  await registry.writeCandidate(publishCandidate);
  await registry.activateCandidate(activeCandidate.id, { actor: "workflow.evolution.test" });

  const publishWorkflow = validateWorkflowYaml(
    `
id: candidate-publish-v1
version: "1.0.0"
catalogVersion: local-workflow-catalog-v1
nodes:
  - id: publish
    type: candidate.publish
    config:
      candidateId: ${publishCandidate.id}
      actor: workflow.evolution.test
      reason: promote candidate via workflow node
    outputs:
      publish:
        type: object
      active:
        type: object
      snapshotId:
        type: string
edges: []
outputs:
  publish:
    node: publish
    outputPort: publish
  active:
    node: publish
    outputPort: active
  snapshotId:
    node: publish
    outputPort: snapshotId
`,
    { filePath: "candidate-publish-v1.yml" }
  );

  const publishResult = await runWorkflow({
    workflow: publishWorkflow,
    input: { registryRoot }
  });

  assert.equal((await registry.readActive()).id, publishCandidate.id);
  assert.equal(publishResult.outputs.active?.id, publishCandidate.id);
  assert.equal(typeof publishResult.outputs.snapshotId, "string");
  assert.ok(publishResult.outputs.snapshotId.length > 0);

  const rollbackWorkflow = validateWorkflowYaml(
    `
id: candidate-rollback-v1
version: "1.0.0"
catalogVersion: local-workflow-catalog-v1
nodes:
  - id: snapshot-id
    type: input
    config:
      name: snapshotId
    outputs:
      value:
        type: string
  - id: rollback
    type: candidate.rollback
    config:
      actor: workflow.evolution.test
      reason: rollback candidate publish via workflow node
    inputs:
      snapshotId:
        type: string
    outputs:
      rollback:
        type: object
      active:
        type: object
      snapshotId:
        type: string
edges:
  - from:
      node: snapshot-id
      outputPort: value
    to:
      node: rollback
      inputPort: snapshotId
outputs:
  rollback:
    node: rollback
    outputPort: rollback
  active:
    node: rollback
    outputPort: active
  snapshotId:
    node: rollback
    outputPort: snapshotId
`,
    { filePath: "candidate-rollback-v1.yml" }
  );

  const rollbackResult = await runWorkflow({
    workflow: rollbackWorkflow,
    input: {
      registryRoot,
      snapshotId: publishResult.outputs.snapshotId
    }
  });

  assert.equal((await registry.readActive()).id, activeCandidate.id);
  assert.equal(rollbackResult.outputs.active?.id, activeCandidate.id);
  assert.equal(rollbackResult.outputs.snapshotId, publishResult.outputs.snapshotId);
});

test("candidate.publish requires candidateId", async () => {
  const workflow = validateWorkflowYaml(
    `
id: candidate-publish-missing-id-v1
version: "1.0.0"
catalogVersion: local-workflow-catalog-v1
nodes:
  - id: publish
    type: candidate.publish
    outputs:
      publish:
        type: object
edges: []
outputs:
  publish:
    node: publish
    outputPort: publish
`,
    { filePath: "candidate-publish-missing-id-v1.yml" }
  );
  await assert.rejects(
    () => runWorkflow({ workflow, input: {} }),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED" && error.message.includes("candidateId")
  );
});

test("candidate.rollback requires snapshotId", async () => {
  const workflow = validateWorkflowYaml(
    `
id: candidate-rollback-missing-id-v1
version: "1.0.0"
catalogVersion: local-workflow-catalog-v1
nodes:
  - id: rollback
    type: candidate.rollback
    outputs:
      rollback:
        type: object
edges: []
outputs:
  rollback:
    node: rollback
    outputPort: rollback
`,
    { filePath: "candidate-rollback-missing-id-v1.yml" }
  );
  await assert.rejects(
    () => runWorkflow({ workflow, input: {} }),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED" && error.message.includes("snapshotId")
  );
});

async function runFixture(name) {
  const workflow = validateWorkflowYaml(await fs.readFile(path.join(repoRoot, "fixtures", "workflows", name), "utf8"), {
    filePath: name
  });
  return runWorkflow({ workflow, input: {} });
}

function candidateWithId(candidate, id, versionName) {
  const copy = structuredClone(candidate);
  copy.id = id;
  copy.versionName = versionName;
  copy.contracts.workflowCandidate.id = `${id}_workflow`;
  copy.contracts.workflowCandidate.versionName = versionName;
  copy.contracts.publishRecord.id = `${id}_publish`;
  copy.contracts.publishRecord.candidateId = id;
  copy.contracts.publishRecord.versionName = versionName;
  return copy;
}

async function readRegistryCandidateFixture(name) {
  return JSON.parse(await fs.readFile(path.join(repoRoot, "fixtures", "registry", name), "utf8"));
}
