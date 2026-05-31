import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ObsidianVault, splitCandidate, validateHierarchy } from "../src/vault/adapter.js";
import { parseMarkdownNote } from "../src/vault/markdown.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const fixtureDir = path.join(repoRoot, "fixtures", "vault");

test("indexes notes by tag, backlink, title, and body text", async () => {
  const vault = new ObsidianVault({ root: path.join(fixtureDir, "basic-vault") });
  const meeting = await vault.index({ query: "회의", tag: "meeting" });
  assert.deepEqual(meeting.map((note) => note.id).sort(), ["core-principles", "meeting-prep", "meeting-retro"]);

  const backlink = await vault.index({ query: "memory/reasoning/meeting-retro" });
  assert.ok(backlink.map((note) => note.id).includes("meeting-prep"));
});

test("core notes require importance and recall policy metadata", async () => {
  const notes = await new ObsidianVault({ root: path.join(fixtureDir, "basic-vault") }).index({ tag: "core" });
  assert.equal(notes[0].importance, "core");
  assert.equal(notes[0].recallPolicyRef, "core-default");
});

test("oversized published notes fail validation", async () => {
  await assert.rejects(
    () => new ObsidianVault({ root: path.join(fixtureDir, "invalid-oversized-vault") }).index(),
    (error) => error.code === "VAULT_NOTE_TOO_LARGE"
  );
});

test("split candidates describe parent and child note ids", async () => {
  const markdown = await fs.readFile(path.join(fixtureDir, "oversized-core-note.md"), "utf8");
  const candidate = splitCandidate(markdown);
  assert.equal(candidate.parent, "memory/core/core-principles.md");
  assert.deepEqual(candidate.childIds, ["core-principles-part-1", "core-principles-part-2", "core-principles-part-3"]);
});

test("path traversal and symlink write attempts fail", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-vault-"));
  const vault = new ObsidianVault({ root });
  await assert.rejects(
    () => vault.writeCandidate("../escape.md", "# nope"),
    (error) => error.code === "VAULT_PATH_OUTSIDE_ROOT"
  );

  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "oba-vault-outside-"));
  await vault.ensureLayout();
  await fs.symlink(outside, path.join(root, "memory", "reasoning", "escape-link"));
  await assert.rejects(
    () => vault.writeCandidate("memory/reasoning/escape-link/owned.md", "# nope"),
    (error) => error.code === "VAULT_PATH_OUTSIDE_ROOT"
  );
});

test("malformed frontmatter fails with VAULT_FRONTMATTER_INVALID", () => {
  assert.throws(
    () => parseMarkdownNote("---\nid: missing-required\n---\n# Broken\n"),
    (error) => error.code === "VAULT_FRONTMATTER_INVALID"
  );
});

test("hierarchy cycles, orphan children, and backlink disagreements fail", () => {
  const base = {
    relativePath: "memory/reasoning/a.md",
    body: "",
    title: "a",
    wikilinks: [],
    frontmatter: {
      id: "a",
      parent: "",
      children: ["missing"]
    }
  };
  assert.throws(() => validateHierarchy([base]), (error) => error.code === "VAULT_HIERARCHY_INVALID");

  const cycleA = structuredClone(base);
  cycleA.frontmatter.children = ["b"];
  cycleA.frontmatter.parent = "b";
  const cycleB = structuredClone(base);
  cycleB.relativePath = "memory/reasoning/b.md";
  cycleB.frontmatter.id = "b";
  cycleB.frontmatter.children = ["a"];
  cycleB.frontmatter.parent = "a";
  assert.throws(() => validateHierarchy([cycleA, cycleB]), (error) => error.code === "VAULT_HIERARCHY_INVALID");
});
