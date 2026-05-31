import fs from "node:fs/promises";
import path from "node:path";
import { FileRegistry } from "./registry/file-registry.js";
import { runGatewayWorkflow } from "./workflows/gateway-runner.js";

const REQUIRED_ELEMENTS = {
  nodeProposal: "workflow-node-registry",
  skillProposal: "codex-skill",
  hookProposal: "codex-hook",
  systemPromptProposal: "main-agent-system-prompt",
  exaoneSystemPromptProposal: "exaone-system-prompt"
};

export async function stageSelfImprovementCandidates(body, { root = process.cwd() } = {}) {
  validateCandidateRequest(body);
  const workflowPath = body.workflowPath || "fixtures/workflows/evolution-candidates.yml";
  const result = await runGatewayWorkflow({ workflowPath, input: body.input ?? {} }, { root });
  const runId = safeId(body.runId || `self-improvement-${Date.now()}`);
  const artifactRoot = path.join(root, ".oppa", "self-improvement", "candidates", runId);
  await fs.mkdir(artifactRoot, { recursive: true });

  const artifacts = [];
  for (const [outputKey, element] of Object.entries(REQUIRED_ELEMENTS)) {
    const candidate = result.outputs?.[outputKey];
    if (!candidate) {
      throw requestError(`workflow did not produce required candidate output: ${outputKey}`, "SELF_IMPROVEMENT_OUTPUT_MISSING");
    }
    const artifact = await writeCandidateArtifact({
      artifactRoot,
      outputKey,
      element,
      candidate,
      workflowId: result.workflowId,
      workflowPath
    });
    artifacts.push(artifact);
  }

  return {
    ok: true,
    workflowId: result.workflowId,
    workflowPath,
    runId,
    codexImplementer: {
      role: "isolated-implementer",
      runtime: false,
      userVisible: false,
      instructionMode: "intent-and-acceptance-criteria"
    },
    artifactRoot: path.relative(root, artifactRoot),
    artifacts,
    outputs: result.outputs
  };
}

export async function runSelfImprovementRegistrySmoke(body = {}, { root = process.cwd() } = {}) {
  const registry = new FileRegistry({ root, lockHoldMs: 0 });
  const seed = candidateWithId(minimalRegistryCandidate(), safeId(body.seedId || "oba_self_improvement_seed"));
  const next = candidateWithId(minimalRegistryCandidate(), safeId(body.candidateId || `oba_self_improvement_test_${Date.now()}`));
  await registry.writeCandidate(seed);
  await registry.writeCandidate(next);
  await registry.activateCandidate(seed.id, {
    actor: "oba.self-improvement",
    reason: "seed active registry state before smoke publish"
  });
  const before = await registry.readActive();
  const publish = await registry.publishCandidate(next.id, {
    actor: "oba.self-improvement",
    reason: "publish safe inert self-improvement test candidate"
  });
  const afterPublish = await registry.readActive();
  const rollback = await registry.rollbackToSnapshot(publish.snapshotId, {
    actor: "oba.self-improvement",
    reason: "rollback safe inert self-improvement test candidate"
  });
  const afterRollback = await registry.readActive();
  return {
    ok: true,
    registryRoot: path.relative(root, path.join(root, ".oppa", "registry")),
    before,
    publish,
    afterPublish,
    rollback,
    afterRollback
  };
}

function validateCandidateRequest(body) {
  if (body !== undefined && (!body || typeof body !== "object" || Array.isArray(body))) {
    throw requestError("request body must be a JSON object");
  }
  if (body?.workflowPath !== undefined && (typeof body.workflowPath !== "string" || body.workflowPath.trim().length === 0)) {
    throw requestError("workflowPath must be a non-empty string");
  }
}

async function writeCandidateArtifact({ artifactRoot, outputKey, element, candidate, workflowId, workflowPath }) {
  const fileName = `${element}.json`;
  const absolutePath = path.join(artifactRoot, fileName);
  const artifact = {
    element,
    outputKey,
    status: "candidate",
    version: {
      id: `${workflowId}:${element}:${new Date().toISOString()}`,
      state: "staged",
      rollbackReady: Boolean(candidate.rollback)
    },
    provenance: {
      workflowId,
      workflowPath,
      generatedAt: new Date().toISOString()
    },
    before: null,
    after: candidate,
    rollback: candidate.rollback ?? null
  };
  await fs.writeFile(absolutePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return {
    element,
    outputKey,
    path: path.relative(process.cwd(), absolutePath),
    candidateKind: candidate.kind,
    target: candidate.target
  };
}

function minimalRegistryCandidate() {
  const now = new Date().toISOString();
  return {
    id: "placeholder",
    versionName: "self-improvement-safe-test",
    reason: "Safe inert registry publish/rollback test for self-improvement plumbing.",
    changed: ["local_workflow_registry"],
    contracts: {
      workflowCandidate: {
        id: "placeholder_workflow",
        versionName: "self-improvement-safe-test",
        reason: "Exercise publish and rollback with an inert workflow candidate.",
        changed: ["local_workflow_registry"],
        patches: {
          localWorkflowRegistry: {
            operations: [{
              op: "add",
              path: "/nodes/selfImprovementSafeTest",
              value: { type: "noop", activatedAt: now }
            }]
          },
          localWorkflowYaml: "id: self-improvement-safe-test\nversion: \"1.0.0\"\n"
        },
        smokeTests: [{
          name: "inert-publish-rollback",
          input: "publish safe test candidate",
          expected: "rollback restores previous active candidate"
        }]
      }
    }
  };
}

function candidateWithId(candidate, id) {
  const copy = structuredClone(candidate);
  copy.id = id;
  copy.contracts.workflowCandidate.id = `${id}_workflow`;
  copy.versionName = `${id}-version`;
  copy.contracts.workflowCandidate.versionName = `${id}-workflow-version`;
  return copy;
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function requestError(message, code = "VALIDATION_ERROR") {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}
