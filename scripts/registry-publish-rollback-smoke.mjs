#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileRegistry } from "../services/agent-gateway/src/registry/file-registry.js";

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("usage: node scripts/registry-publish-rollback-smoke.mjs <candidate.json>");
  process.exit(2);
}

let root = null;
try {
  const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-registry-publish-rollback-"));
  const registry = new FileRegistry({ root, lockHoldMs: 0 });

  const previous = mutateCandidateId(fixture, "candidate_smoke_previous");
  const next = mutateCandidateId(fixture, "candidate_smoke_next");

  await registry.writeCandidate(previous);
  await registry.activateCandidate(previous.id, {
    actor: "registry-smoke",
    reason: "seed previous active"
  });
  await registry.writeCandidate(next);

  const publish = await registry.publishCandidate(next.id, {
    actor: "registry-smoke",
    reason: "publish new candidate"
  });
  const rollback = await registry.rollbackToSnapshot(publish.snapshotId, {
    actor: "registry-smoke",
    reason: "rollback smoke"
  });
  const journalTypes = await readJournalTypes(root);

  console.log(`published=${publish.active.id}`);
  console.log(`snapshot=${publish.snapshotId}`);
  console.log(`rollbackRestored=${rollback.active.id}`);
  console.log(`journal=${journalTypes.join(",")}`);
} catch (error) {
  console.error(error.code ?? error.name ?? "ERROR");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (root) {
    await fs.rm(root, { recursive: true, force: true });
    console.log(`cleanup=removed ${root}`);
  } else {
    console.log("cleanup=removed <none>");
  }
}

function mutateCandidateId(candidate, id) {
  const copy = structuredClone(candidate);
  copy.id = id;
  if (copy.contracts?.publishRecord) {
    copy.contracts.publishRecord.candidateId = id;
  }
  return copy;
}

async function readJournalTypes(root) {
  const journalPath = path.join(root, ".oppa", "registry", "journal.ndjson");
  const content = await fs.readFile(journalPath, "utf8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line).type);
}
