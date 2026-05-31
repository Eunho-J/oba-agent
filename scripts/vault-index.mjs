#!/usr/bin/env node
import { ObsidianVault } from "../services/agent-gateway/src/vault/adapter.js";

const [vaultRoot, ...args] = process.argv.slice(2);
if (!vaultRoot) {
  console.error("usage: node scripts/vault-index.mjs <vault-root> [--query text] [--tag tag]");
  process.exit(2);
}

const options = parseArgs(args);

try {
  const notes = await new ObsidianVault({ root: vaultRoot }).index(options);
  for (const note of notes) console.log(`${note.id}\t${note.path}\t${note.title}`);
  console.log(`vault index ok matches=${notes.length}`);
} catch (error) {
  console.error(error.code ?? error.name ?? "VAULT_ERROR");
  console.error(error.message);
  process.exit(1);
}

function parseArgs(args) {
  const options = { query: "", tag: "" };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--query") options.query = args[index + 1] ?? "";
    if (args[index] === "--tag") options.tag = args[index + 1] ?? "";
  }
  return options;
}
