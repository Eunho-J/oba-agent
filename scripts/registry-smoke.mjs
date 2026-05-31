#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileRegistry } from "../services/agent-gateway/src/registry/file-registry.js";

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("usage: node scripts/registry-smoke.mjs <candidate.json>");
  process.exit(2);
}

try {
  const candidate = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-registry-smoke-"));
  const registry = new FileRegistry({ root, lockHoldMs: 0 });
  await registry.writeCandidate(candidate);
  const active = await registry.activateCandidate(candidate.id, {
    actor: "registry-smoke",
    reason: "smoke activation"
  });
  console.log(`registry smoke ok active=${active.id}`);
} catch (error) {
  console.error(error.code ?? error.name ?? "ERROR");
  console.error(error.message);
  process.exit(1);
}
