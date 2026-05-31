#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const needle = /\bmiso\b/i;
const allowedPrefixes = [
  "docs/vendor/miso/"
];
const ignoredPrefixes = [
  ".git/",
  ".omo/",
  ".omx/",
  "node_modules/"
];
const ignoredFiles = new Set([
  "scripts/qa/no-miso-runtime.mjs",
  "fixtures/registry/legacy-miso-candidate.json"
]);

const violations = [];
let archivedReferenceCount = 0;

await visit(repoRoot);

if (violations.length > 0) {
  console.error("runtime MISO references found outside archived vendor material:");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}

console.log(`no runtime MISO references; archived vendor references only (${archivedReferenceCount} files scanned)`);

async function visit(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = toRepoRelative(absolutePath);
    if (entry.isDirectory()) {
      if (!ignoredPrefixes.some((prefix) => `${relativePath}/`.startsWith(prefix))) {
        await visit(absolutePath);
      }
      continue;
    }
    if (!entry.isFile() || ignoredFiles.has(relativePath) || ignoredPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }
    if (await isBinary(absolutePath)) continue;
    const text = await fs.readFile(absolutePath, "utf8");
    if (!needle.test(text)) continue;
    if (allowedPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      archivedReferenceCount += 1;
      continue;
    }
    const line = text.split(/\r?\n/).findIndex((value) => needle.test(value)) + 1;
    violations.push(`${relativePath}:${line}`);
  }
}

function toRepoRelative(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

async function isBinary(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(512);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } finally {
    await handle.close();
  }
}
