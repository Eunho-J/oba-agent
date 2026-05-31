import { asString } from "./runtime-utils.js";
import { workflowError } from "./errors.js";
import { FileRegistry } from "../registry/file-registry.js";

const CANDIDATE_KIND_BY_TYPE = {
  "candidate.writeWorkflowPatch": "workflowPatch",
  "candidate.writeVaultPatch": "vaultPatch",
  "candidate.writeNodeProposal": "nodeProposal",
  "candidate.writeSystemPromptProposal": "systemPromptProposal",
  "candidate.writeSkillProposal": "skillProposal",
  "candidate.writeHookProposal": "hookProposal",
  "candidate.writeCodexDelegation": "codexDelegation"
};

export function executeCandidateNode(node, { inputs, runtimeInput }) {
  if (node.type === "candidate.publish") return publishCandidate(node, { inputs, runtimeInput });
  if (node.type === "candidate.rollback") return rollbackCandidate(node, { inputs, runtimeInput });

  const kind = CANDIDATE_KIND_BY_TYPE[node.type];
  const config = node.config ?? {};
  const candidate = {
    kind,
    target: inputs.target ?? config.target ?? null,
    proposal: inputs.proposal ?? config.proposal ?? {},
    rationale: asString(inputs.rationale ?? config.rationale ?? ""),
    tests: inputs.tests ?? config.tests ?? [],
    rollback: inputs.rollback ?? config.rollback ?? null,
    status: "candidate"
  };
  validateCandidate(candidate);
  return emit(node, { candidate });
}

async function publishCandidate(node, { inputs, runtimeInput }) {
  const config = node.config ?? {};
  const root = resolveRegistryRoot(runtimeInput, config);
  const candidateId = resolveCandidateId(inputs, config, node);
  const registry = new FileRegistry({ root });
  const actor = resolveActor(inputs, config);
  const reason = resolveReason(inputs, config);
  const publish = await registry.publishCandidate(candidateId, { actor, reason });
  return emit(node, {
    publish,
    active: publish?.active ?? null,
    snapshotId: publish?.snapshotId ?? null
  });
}

async function rollbackCandidate(node, { inputs, runtimeInput }) {
  const config = node.config ?? {};
  const root = resolveRegistryRoot(runtimeInput, config);
  const snapshotId = resolveSnapshotId(inputs, config, node);
  const registry = new FileRegistry({ root });
  const actor = resolveActor(inputs, config);
  const reason = resolveReason(inputs, config);
  const rollback = await registry.rollbackToSnapshot(snapshotId, { actor, reason });
  return emit(node, {
    rollback,
    active: rollback?.active ?? null,
    snapshotId: rollback?.snapshotId ?? snapshotId
  });
}

function validateCandidate(candidate) {
  if (!candidate.kind) throw workflowError("candidate node kind is required");
  if (candidate.kind === "nodeProposal") requireFields(candidate.proposal, ["nodeType", "catalogEntry", "tests"], candidate.kind);
  if (candidate.kind === "systemPromptProposal") {
    requireTarget(candidate.target, ["obaMainAgent", "exaoneExpressionAgent"], candidate.kind);
    requireFields(candidate.proposal, ["prompt", "safetyInvariants", "regressionTests"], candidate.kind);
  }
  if (candidate.kind === "skillProposal") requireFields(candidate.proposal, ["skillMd", "metadata", "tests"], candidate.kind);
  if (candidate.kind === "hookProposal") {
    requireFields(candidate.proposal, ["event", "matcher", "command", "timeoutMs", "failurePolicy", "diagnosticShape", "tests"], candidate.kind);
    if (candidate.proposal.failurePolicy !== "diagnostic") {
      throw workflowError("hookProposal failurePolicy must be diagnostic");
    }
  }
  if (candidate.kind === "codexDelegation") {
    requireFields(candidate.proposal, ["intent", "constraints", "acceptanceCriteria"], candidate.kind);
    if (candidate.proposal.codeLevelInstructions && candidate.proposal.advancedOverride !== true) {
      throw workflowError("codexDelegation rejects code-level instructions without advancedOverride");
    }
  }
}

function requireFields(value, fields, kind) {
  for (const field of fields) {
    if (value?.[field] === undefined || value?.[field] === "") {
      throw workflowError(`${kind} proposal requires ${field}`);
    }
  }
}

function requireTarget(target, allowed, kind) {
  if (!allowed.includes(target)) throw workflowError(`${kind} target must be one of ${allowed.join(", ")}`);
}

function resolveRegistryRoot(runtimeInput, config) {
  return runtimeInput?.registryRoot ?? config.root ?? process.cwd();
}

function resolveCandidateId(inputs, config, node) {
  const candidateId = inputs.candidateId ?? inputs.candidate?.id ?? config.candidateId;
  if (!candidateId) throw workflowError(`${node.type} requires candidateId`);
  return asString(candidateId);
}

function resolveSnapshotId(inputs, config, node) {
  const snapshotId = inputs.snapshotId ?? inputs.publish?.snapshotId ?? config.snapshotId;
  if (!snapshotId) throw workflowError(`${node.type} requires snapshotId`);
  return asString(snapshotId);
}

function resolveActor(inputs, config) {
  const actor = inputs.actor ?? config.actor;
  return actor === undefined ? undefined : asString(actor);
}

function resolveReason(inputs, config) {
  const reason = inputs.reason ?? config.reason;
  return reason === undefined ? undefined : asString(reason);
}

function emit(node, values) {
  const declared = Object.keys(node.outputs ?? {});
  if (declared.length === 0) return values;
  return Object.fromEntries(Object.entries(values).filter(([key]) => declared.includes(key)));
}
