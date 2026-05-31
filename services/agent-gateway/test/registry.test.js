import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CONTRACT_NAMES = [
  "sttTranscript",
  "exaoneNormalizedInput",
  "exaoneNormalizedOutput",
  "recallPolicy",
  "expressionMemory",
  "reasoningMemory",
  "workflowCandidate",
  "publishRecord",
  "rollbackRecord",
  "gguiWorkbenchEvent"
];

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const fixtureDir = path.join(repoRoot, "fixtures", "registry");

async function readJson(fileName) {
  return JSON.parse(await fs.readFile(path.join(fixtureDir, fileName), "utf8"));
}

async function registryRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "oba-registry-"));
}

function candidateWithId(candidate, id) {
  const copy = structuredClone(candidate);
  copy.id = id;
  copy.contracts.publishRecord.candidateId = id;
  return copy;
}

async function importSchemas() {
  return import("../src/contracts/schemas.js");
}

async function importFileRegistry() {
  return import("../src/registry/file-registry.js");
}

function exportedContractNames(schemas) {
  return schemas.CONTRACT_NAMES
    ?? schemas.contractNames
    ?? Object.keys(schemas.contractSchemas ?? schemas.schemas ?? {});
}

async function validateContract(schemas, name, value) {
  if (typeof schemas.validateContract !== "function") {
    throw new TypeError("schemas.js must export validateContract(name, value)");
  }
  return schemas.validateContract(name, value);
}

function assertRegistryValidationError(error) {
  assert.equal(error.code, "REGISTRY_VALIDATION_FAILED");
  return true;
}

function assertRegistryLocked(error) {
  assert.equal(error.code, "REGISTRY_LOCKED");
  return true;
}

async function readJournal(root) {
  const journalPath = path.join(root, ".oppa", "registry", "journal.ndjson");
  const raw = await fs.readFile(journalPath, "utf8");
  return raw.trim().split("\n").map((line) => JSON.parse(line));
}

async function readSnapshot(root, snapshotId) {
  const snapshotPath = path.join(root, ".oppa", "registry", "snapshots", `${snapshotId}.json`);
  return JSON.parse(await fs.readFile(snapshotPath, "utf8"));
}

async function findTempFiles(root) {
  const registryPath = path.join(root, ".oppa", "registry");
  const found = [];

  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const current = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(current);
        continue;
      }
      if (
        entry.name.endsWith(".tmp")
        || entry.name.endsWith(".temp")
        || entry.name.endsWith(".partial")
        || entry.name.includes("-tmp-")
      ) {
        found.push(path.relative(registryPath, current));
      }
    }
  }

  await visit(registryPath);
  return found.sort();
}

test("contract schemas expose and validate every registry contract", async () => {
  const schemas = await importSchemas();
  const candidate = await readJson("minimal-active.json");

  assert.deepEqual(exportedContractNames(schemas).sort(), CONTRACT_NAMES.toSorted());
  for (const name of CONTRACT_NAMES) {
    await assert.doesNotReject(() => validateContract(schemas, name, candidate.contracts[name]));
  }
});

test("malformed registry candidates reject with REGISTRY_VALIDATION_FAILED", async () => {
  const schemas = await importSchemas();
  const { FileRegistry } = await importFileRegistry();
  const candidate = await readJson("malformed-candidate.json");

  await assert.rejects(
    () => validateContract(schemas, "workflowCandidate", candidate.contracts.workflowCandidate),
    assertRegistryValidationError
  );

  const registry = new FileRegistry({ root: await registryRoot() });
  await assert.rejects(
    () => registry.writeCandidate(candidate),
    assertRegistryValidationError
  );
});

test("file registry writes candidates, publishes active.json with snapshot, and rolls back", async () => {
  const { FileRegistry } = await importFileRegistry();
  const root = await registryRoot();
  const registry = new FileRegistry({ root });
  const base = await readJson("minimal-active.json");
  const previous = candidateWithId(base, "candidate_previous");
  const next = candidateWithId(base, "candidate_next");

  await registry.writeCandidate(previous);
  await registry.activateCandidate(previous.id, {
    actor: "registry.test",
    reason: "seed previous active"
  });
  await registry.writeCandidate(next);

  const publish = await registry.publishCandidate(next.id, {
    actor: "registry.test",
    reason: "promote validated candidate"
  });

  assert.equal(publish.active.id, next.id);
  assert.equal(publish.previousActiveId, previous.id);
  assert.ok(publish.snapshotId);
  assert.equal((await readSnapshot(root, publish.snapshotId)).id, previous.id);

  const activePath = path.join(root, ".oppa", "registry", "active.json");
  const active = JSON.parse(await fs.readFile(activePath, "utf8"));
  assert.equal(active.id, next.id);
  assert.equal(active.versionName, next.versionName);

  const rollback = await registry.rollbackToSnapshot(publish.snapshotId, {
    actor: "registry.test",
    reason: "smoke rollback"
  });
  assert.equal(rollback.active.id, previous.id);
  assert.equal(rollback.fromVersionId, next.id);
  assert.equal(rollback.toVersionId, previous.id);
  assert.equal((await registry.readActive()).id, previous.id);

  const journal = await readJournal(root);
  assert.deepEqual(journal.map((entry) => entry.type), [
    "candidate.write",
    "candidate.publish",
    "candidate.activate",
    "candidate.write",
    "candidate.publish",
    "candidate.rollback"
  ]);
  assert.equal(journal[4].snapshotId, publish.snapshotId);
  assert.equal(journal[5].snapshotId, publish.snapshotId);
  assert.equal(journal[5].fromVersionId, next.id);
  assert.equal(journal[5].toVersionId, previous.id);
});

test("concurrent activation attempts return one success and one REGISTRY_LOCKED error", async () => {
  const { FileRegistry } = await importFileRegistry();
  const root = await registryRoot();
  const firstRegistry = new FileRegistry({ root });
  const secondRegistry = new FileRegistry({ root });
  const base = await readJson("minimal-active.json");
  const firstCandidate = candidateWithId(base, "candidate_concurrent_first");
  const secondCandidate = candidateWithId(base, "candidate_concurrent_second");

  await firstRegistry.writeCandidate(firstCandidate);
  await firstRegistry.writeCandidate(secondCandidate);

  const settled = await Promise.allSettled([
    firstRegistry.activateCandidate(firstCandidate.id, { actor: "registry.test" }),
    secondRegistry.activateCandidate(secondCandidate.id, { actor: "registry.test" })
  ]);

  assert.equal(settled.filter((entry) => entry.status === "fulfilled").length, 1);
  const rejected = settled.find((entry) => entry.status === "rejected");
  assert.ok(rejected);
  assertRegistryLocked(rejected.reason);
});

test("activateCandidate remains backward compatible and journals publish/activation path", async () => {
  const { FileRegistry } = await importFileRegistry();
  const root = await registryRoot();
  const registry = new FileRegistry({ root });
  const candidate = await readJson("minimal-active.json");

  await registry.writeCandidate(candidate);
  const activated = await registry.activateCandidate(candidate.id, {
    actor: "registry.test",
    reason: "legacy activation path"
  });

  assert.equal(activated.id, candidate.id);
  const journalTypes = (await readJournal(root)).map((entry) => entry.type);
  assert.deepEqual(journalTypes, ["candidate.write", "candidate.publish", "candidate.activate"]);
});

test("failed publish keeps previous active unchanged", async () => {
  const { FileRegistry } = await importFileRegistry();
  const root = await registryRoot();
  const registry = new FileRegistry({ root });
  const base = await readJson("minimal-active.json");
  const previous = candidateWithId(base, "candidate_publish_guard_previous");
  const invalid = candidateWithId(base, "candidate_publish_guard_invalid");
  delete invalid.contracts.workflowCandidate.id;

  await registry.writeCandidate(previous);
  await registry.activateCandidate(previous.id, { actor: "registry.test" });

  const malformedPath = path.join(
    root,
    ".oppa",
    "registry",
    "candidates",
    `${invalid.id}.json`
  );
  await fs.writeFile(malformedPath, `${JSON.stringify(invalid, null, 2)}\n`, "utf8");

  await assert.rejects(
    () => registry.publishCandidate(invalid.id, { actor: "registry.test", reason: "should reject" }),
    assertRegistryValidationError
  );

  const active = await registry.readActive();
  assert.equal(active.id, previous.id);

  const snapshotsRoot = path.join(root, ".oppa", "registry", "snapshots");
  assert.deepEqual(await fs.readdir(snapshotsRoot), []);
});

test("successful publish and rollback leave no temporary atomic-write files behind", async () => {
  const { FileRegistry } = await importFileRegistry();
  const root = await registryRoot();
  const registry = new FileRegistry({ root });
  const base = await readJson("minimal-active.json");
  const previous = candidateWithId(base, "candidate_temp_previous");
  const next = candidateWithId(base, "candidate_temp_next");

  await registry.writeCandidate(previous);
  await registry.activateCandidate(previous.id, { actor: "registry.test" });
  await registry.writeCandidate(next);
  const publish = await registry.publishCandidate(next.id, { actor: "registry.test" });
  await registry.rollbackToSnapshot(publish.snapshotId, { actor: "registry.test" });

  assert.deepEqual(await findTempFiles(root), []);
});
