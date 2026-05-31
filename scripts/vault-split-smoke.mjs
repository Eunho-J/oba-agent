#!/usr/bin/env node
import fs from "node:fs/promises";
import { splitCandidate } from "../services/agent-gateway/src/vault/adapter.js";

const notePath = process.argv[2];
if (!notePath) {
  console.error("usage: node scripts/vault-split-smoke.mjs <note.md>");
  process.exit(2);
}

try {
  const candidate = splitCandidate(await fs.readFile(notePath, "utf8"));
  console.log(`parent ${candidate.parent}`);
  for (const child of candidate.children) console.log(`child ${child.id} ${child.path}`);
} catch (error) {
  console.error(error.code ?? error.name ?? "VAULT_ERROR");
  console.error(error.message);
  process.exit(1);
}
