#!/usr/bin/env node
import { ObsidianVault } from "../services/agent-gateway/src/vault/adapter.js";

const [vaultRoot, relativePath] = process.argv.slice(2);
if (!vaultRoot || !relativePath) {
  console.error("usage: node scripts/vault-write-smoke.mjs <vault-root> <relative-path>");
  process.exit(2);
}

const markdown = `---
id: write-smoke
type: candidate
tags: [smoke]
createdAt: "2026-05-31T00:00:00.000Z"
updatedAt: "2026-05-31T00:00:00.000Z"
source: smoke
links: []
importance: normal
recallPolicyRef: normal-default
maxChars: 2400
splitBy: paragraph
parent: ""
children: []
summary: Write smoke note
---
# Write smoke
`;

try {
  const result = await new ObsidianVault({ root: vaultRoot }).writeCandidate(relativePath, markdown);
  console.log(`vault write ok ${result.path}`);
} catch (error) {
  console.error(error.code ?? error.name ?? "VAULT_ERROR");
  console.error(error.message);
  process.exit(1);
}
