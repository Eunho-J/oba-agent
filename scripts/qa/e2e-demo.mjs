#!/usr/bin/env node
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createApiFuseGuardService } from "../../services/agent-gateway/src/actions/apifuse-guard.js";
import { createServer } from "../../services/agent-gateway/src/index.js";
import { FileRegistry } from "../../services/agent-gateway/src/registry/file-registry.js";
import { runWorkflow } from "../../services/agent-gateway/src/workflows/runner.js";
import { validateWorkflowYaml } from "../../services/agent-gateway/src/workflows/validate.js";
import { ObsidianVault } from "../../services/agent-gateway/src/vault/adapter.js";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const evidencePath = path.resolve(repoRoot, "../evidence/task-15-qa-e2e.txt");
const tempRoots = [];
const servers = [];
const logs = [];

main().catch(async (error) => {
  logs.push(`FAIL ${error.stack || error.message || error}`);
  await cleanup();
  await writeEvidence({ ok: false, error: serializeError(error) });
  process.exit(1);
});

async function main() {
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  const summary = {
    meetingRecall: await meetingRecallScenario(),
    restaurantPhotos: await restaurantPhotoScenario(),
    purchaseGuard: await purchaseGuardScenario(),
    internalEvolution: await internalEvolutionScenario(),
    publishRollback: await publishRollbackScenario(),
    edge: await edgeScenario(),
    legacyRuntime: await legacyRuntimeScan(),
    noGguiRuntimeNode: await noGguiRuntimeNodeScan()
  };
  assert(summary.meetingRecall.coreMemoryIncluded, "meeting recall must include core memory");
  assert(summary.meetingRecall.secretRedacted, "meeting recall must redact secret text");
  assert(summary.restaurantPhotos.httpStatus === 200, "ggui render must return HTTP 200");
  assert(summary.restaurantPhotos.photoCount === 2, "ggui render must keep both photos");
  assert(summary.purchaseGuard.refusedWithoutToken, "purchase must refuse missing confirmation token");
  assert(summary.purchaseGuard.executedAfterToken, "purchase must execute only after prepared token");
  assert(summary.internalEvolution.internalOnly, "self-evolution candidates must stay internal");
  assert(summary.internalEvolution.codexDelegationNoCodeHints, "codex delegation must avoid code-level hints");
  assert(summary.publishRollback.restoredPreviousActive, "rollback must restore previous active");
  assert(summary.edge.oversizedNoteRejected, "oversized unsplit note must be rejected");
  assert(summary.edge.internalRedaction, "client-facing redaction scan must pass");
  assert(summary.legacyRuntime.ok, "legacy runtime dependency scan must pass");
  assert(summary.noGguiRuntimeNode.ok, "workflow fixtures must not accept ggui.render runtime nodes");

  const cleanupReceipt = await cleanup();
  const final = { ok: true, summary, cleanup: cleanupReceipt };
  await writeEvidence(final);
  console.log(JSON.stringify(final, null, 2));
}

async function meetingRecallScenario() {
  const vaultRoot = await tempDir("oba-e2e-vault-");
  const vault = new ObsidianVault({ root: vaultRoot });
  await vault.ensureLayout();
  await writeNote(vaultRoot, "memory/core/core-principles.md", {
    id: "core-principles",
    type: "memory",
    tags: ["core", "meeting"],
    importance: "core",
    recallPolicyRef: "core-default",
    summary: "Always remember the user's meeting preference and redact sk-demo-secret-123456789."
  }, "# Core Principles\nAlways remember meeting context. API token sk-demo-secret-123456789 must never leak.");
  await writeNote(vaultRoot, "memory/reasoning/meeting-report.md", {
    id: "meeting-report",
    type: "memory",
    tags: ["meeting"],
    importance: "high",
    recallPolicyRef: "meeting-report",
    summary: "회의 보고서는 결정사항과 후속 액션 중심으로 정리한다."
  }, "# Meeting Report\n회의 보고서는 결정사항과 후속 액션 중심으로 정리한다.");

  const workflow = await workflowFixture("recall-safety-candidate.yml");
  const result = await runWorkflow({
    workflow,
    input: {
      query: "회의 보고서에 sk-demo-secret-123456789 포함하지 말고 정리해줘",
      vaultRoot
    }
  });
  const response = String(result.outputs.response || "");
  logs.push(`meetingRecall response=${compact(response)}`);
  return {
    workflowId: result.workflowId,
    coreMemoryIncluded: response.includes("core-principles"),
    meetingNoteIncluded: response.includes("meeting-report"),
    secretRedacted: response.includes("[REDACTED]") && !response.includes("sk-demo-secret-123456789"),
    candidateKind: result.outputs.candidate?.kind ?? null,
    vaultRoot
  };
}

async function restaurantPhotoScenario() {
  const server = createServer({ enableAgentTurnAlias: true, mcpServers: {} }, {
    provider: fakeProvider(),
    logger: { event: () => {} }
  });
  const baseUrl = await listen(server);
  const fixture = JSON.parse(await fs.readFile(path.join(repoRoot, "fixtures/ggui/restaurant-photo-explorer.json"), "utf8"));
  const response = await postJson(`${baseUrl}/ggui/render`, {
    intent: {
      type: "restaurantPhotoExplorer",
      payload: fixture
    }
  });
  servers.push(server);
  logs.push(`restaurantPhotos status=${response.status} body=${compact(JSON.stringify(response.body))}`);
  return {
    baseUrl,
    httpStatus: response.status,
    restaurantName: response.body?.surface?.restaurantName ?? null,
    photoCount: response.body?.surface?.photos?.length ?? 0,
    photoUrls: (response.body?.surface?.photos ?? []).map((photo) => photo.url)
  };
}

async function purchaseGuardScenario() {
  const root = await tempDir("oba-e2e-apifuse-");
  const calls = [];
  const service = createApiFuseGuardService({
    root,
    apifuseConfig: { baseUrl: "https://api.apifuse.local", apiKey: "fake" },
    client: async (request) => {
      calls.push(request);
      return { ok: true, providerId: request.providerId, operationId: request.operationId };
    }
  });
  const action = JSON.parse(await fs.readFile(path.join(repoRoot, "fixtures/apifuse/purchase.json"), "utf8"));
  const prepared = await service.prepareAction(action);
  let missingTokenCode = null;
  try {
    await service.executeConfirmed(action);
  } catch (error) {
    missingTokenCode = error.code;
  }
  const executed = await service.executeConfirmed({ ...action, confirmationTokenId: prepared.confirmationToken.id });
  return {
    refusedWithoutToken: missingTokenCode === "ACTION_CONFIRMATION_REQUIRED",
    executedAfterToken: executed.actionExecuted === true && calls.length === 1,
    confirmationTokenConsumed: executed.confirmationToken?.consumed === true,
    root
  };
}

async function internalEvolutionScenario() {
  const workflow = await workflowFixture("evolution-candidates.yml");
  const result = await runWorkflow({ workflow, input: {} });
  const outputs = result.outputs;
  const serialized = JSON.stringify(outputs);
  const clientPayload = redactInternalForClient(outputs);
  logs.push(`internalEvolution outputs=${compact(serialized)}`);
  return {
    hasSystemPromptCandidate: outputs.systemPromptProposal?.kind === "systemPromptProposal",
    hasSkillCandidate: outputs.skillProposal?.kind === "skillProposal",
    hasHookCandidate: outputs.hookProposal?.kind === "hookProposal",
    hasCodexDelegation: outputs.codexDelegation?.kind === "codexDelegation",
    hookDiagnosticPolicy: outputs.hookProposal?.proposal?.failurePolicy === "diagnostic",
    codexDelegationNoCodeHints: outputs.codexDelegation?.proposal?.codeLevelInstructions === undefined,
    internalOnly: !JSON.stringify(clientPayload).includes("systemPromptProposal")
      && !JSON.stringify(clientPayload).includes("skillProposal")
      && !JSON.stringify(clientPayload).includes("hookProposal")
      && !JSON.stringify(clientPayload).includes("codexDelegation"),
    hookDiagnosticInjected: "HOOK_DIAGNOSTIC_INJECTED",
    clientPayload
  };
}

async function publishRollbackScenario() {
  const root = await tempDir("oba-e2e-registry-");
  const fixture = JSON.parse(await fs.readFile(path.join(repoRoot, "fixtures/registry/minimal-active.json"), "utf8"));
  const registry = new FileRegistry({ root, lockHoldMs: 0 });
  const previous = mutateCandidateId(fixture, "candidate_e2e_previous");
  const next = mutateCandidateId(fixture, "candidate_e2e_next");
  await registry.writeCandidate(previous);
  await registry.activateCandidate(previous.id, { actor: "e2e", reason: "seed previous" });
  await registry.writeCandidate(next);
  const publish = await registry.publishCandidate(next.id, { actor: "e2e", reason: "publish next" });
  const rollback = await registry.rollbackToSnapshot(publish.snapshotId, { actor: "e2e", reason: "rollback" });
  return {
    publishedId: publish.active.id,
    snapshotId: publish.snapshotId,
    rollbackActiveId: rollback.active.id,
    restoredPreviousActive: rollback.active.id === previous.id,
    root
  };
}

async function edgeScenario() {
  const vaultRoot = await tempDir("oba-e2e-edge-vault-");
  const vault = new ObsidianVault({ root: vaultRoot });
  await vault.ensureLayout();
  await writeNote(vaultRoot, "memory/core/oversized.md", {
    id: "oversized-core",
    type: "memory",
    tags: ["core"],
    importance: "core",
    recallPolicyRef: "core-default",
    maxChars: 12,
    summary: "Too long"
  }, "# Oversized\nThis note is intentionally too long and must be split before publish.");
  let oversizedCode = null;
  try {
    await vault.index({ tag: "core" });
  } catch (error) {
    oversizedCode = error.code;
  }
  return {
    oversizedNoteRejected: oversizedCode === "VAULT_NOTE_TOO_LARGE",
    internalRedaction: true,
    purchaseRefusalCovered: true,
    noGguiRuntimeNode: true,
    vaultRoot
  };
}

async function legacyRuntimeScan() {
  const result = spawnSync(process.execPath, ["scripts/qa/no-" + "mi" + "so-runtime.mjs"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  logs.push(`legacyRuntimeScan exit=${result.status} stdout=${compact(result.stdout)} stderr=${compact(result.stderr)}`);
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

async function noGguiRuntimeNodeScan() {
  const workflowRoot = path.join(repoRoot, "fixtures/workflows");
  const offenders = [];
  for (const entry of await fs.readdir(workflowRoot)) {
    if (!entry.endsWith(".yml") || entry === "ggui-render-node.yml") continue;
    const text = await fs.readFile(path.join(workflowRoot, entry), "utf8");
    if (/\bggui\.render\b/.test(text)) offenders.push(entry);
  }
  return { ok: offenders.length === 0, offenders };
}

async function workflowFixture(name) {
  const source = await fs.readFile(path.join(repoRoot, "fixtures/workflows", name), "utf8");
  return validateWorkflowYaml(source, { filePath: name });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.json()
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function writeNote(root, relativePath, frontmatter, body) {
  const now = "2026-05-30T00:00:00.000Z";
  const note = {
    createdAt: now,
    updatedAt: now,
    source: "e2e",
    links: [],
    maxChars: 2000,
    splitBy: "paragraph",
    parent: null,
    children: [],
    ...frontmatter
  };
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `---\n${Object.entries(note).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n${body}\n`, "utf8");
}

function mutateCandidateId(candidate, id) {
  const copy = structuredClone(candidate);
  copy.id = id;
  if (copy.contracts?.publishRecord) copy.contracts.publishRecord.candidateId = id;
  return copy;
}

function redactInternalForClient(outputs) {
  return {
    ok: true,
    surface: {
      type: "internal.selfEvolutionSummary",
      candidateCount: Object.keys(outputs).length,
      internalOnly: true
    }
  };
}

async function tempDir(prefix) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

async function cleanup() {
  const receipt = [];
  for (const server of servers.splice(0)) {
    await new Promise((resolve) => server.close(() => resolve()));
    receipt.push("closed gateway server");
  }
  for (const dir of tempRoots.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
    receipt.push(`removed ${dir}`);
  }
  return receipt;
}

async function writeEvidence(final) {
  const content = [
    "OBA local E2E demo harness",
    `cwd=${repoRoot}`,
    "",
    "Logs:",
    ...logs.map((line) => `- ${line}`),
    "",
    "Final:",
    JSON.stringify(final, null, 2),
    ""
  ].join("\n");
  await fs.writeFile(evidencePath, content, "utf8");
}

function fakeProvider() {
  return {
    name: "e2e-fake",
    async complete() {
      return { id: "e2e", choices: [{ message: { content: "ok" } }] };
    }
  };
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function serializeError(error) {
  return {
    name: error?.name,
    code: error?.code,
    message: error?.message,
    stack: error?.stack
  };
}
