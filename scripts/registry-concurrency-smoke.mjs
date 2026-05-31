#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileRegistry } from "../services/agent-gateway/src/registry/file-registry.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(scriptDir, "../fixtures/registry/minimal-active.json");
const base = JSON.parse(await fs.readFile(fixturePath, "utf8"));
const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-registry-concurrency-"));
const first = new FileRegistry({ root, lockHoldMs: 50 });
const second = new FileRegistry({ root, lockHoldMs: 50 });
const candidates = [
  { ...base, id: "concurrency_first" },
  { ...base, id: "concurrency_second" }
];

await first.writeCandidate(candidates[0]);
await second.writeCandidate(candidates[1]);

const settled = await Promise.allSettled([
  first.activateCandidate(candidates[0].id, { actor: "registry-concurrency-smoke" }),
  second.activateCandidate(candidates[1].id, { actor: "registry-concurrency-smoke" })
]);

const success = settled.find((entry) => entry.status === "fulfilled");
const locked = settled.find((entry) => entry.status === "rejected" && entry.reason?.code === "REGISTRY_LOCKED");

if (!success || !locked) {
  console.error("registry concurrency failed");
  console.error(JSON.stringify(settled, null, 2));
  process.exit(1);
}

console.log(`activation success ${success.value.id}`);
console.log("activation rejected REGISTRY_LOCKED");
