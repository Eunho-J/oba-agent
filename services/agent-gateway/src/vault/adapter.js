import fs from "node:fs/promises";
import path from "node:path";
import { vaultError } from "./errors.js";
import { parseMarkdownNote } from "./markdown.js";

export const REQUIRED_VAULT_DIRS = [
  "memory/core",
  "memory/reasoning",
  "memory/expression",
  "workflows",
  "daily",
  "inbox",
  "raw",
  "published",
  "snapshots"
];

export class ObsidianVault {
  constructor({ root }) {
    this.root = path.resolve(root);
  }

  async ensureLayout() {
    for (const dir of REQUIRED_VAULT_DIRS) {
      await fs.mkdir(path.join(this.root, dir), { recursive: true });
    }
  }

  async index({ query = "", tag = "" } = {}) {
    await this.ensureLayout();
    const notes = [];
    for (const filePath of await markdownFiles(this.root)) {
      const relativePath = toVaultRelative(this.root, filePath);
      const note = parseMarkdownNote(await fs.readFile(filePath, "utf8"), { relativePath });
      validateNoteSize(note);
      notes.push(note);
    }
    validateHierarchy(notes);
    const index = {
      generatedAt: new Date().toISOString(),
      notes: notes.map((note) => noteIndexEntry(note))
    };
    await atomicWriteJson(path.join(this.root, "index.json"), index);
    return filterNotes(index.notes, { query, tag });
  }

  async read(relativePath) {
    const target = await this.safePath(relativePath);
    const markdown = await fs.readFile(target, "utf8");
    return parseMarkdownNote(markdown, { relativePath: toVaultRelative(this.root, target) });
  }

  async writeCandidate(relativePath, markdown) {
    const target = await this.safePath(relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await atomicWriteText(target, markdown);
    return { path: toVaultRelative(this.root, target) };
  }

  async safePath(relativePath) {
    if (path.isAbsolute(relativePath)) {
      throw vaultError("VAULT_PATH_OUTSIDE_ROOT", "absolute vault paths are not allowed", { relativePath });
    }
    const target = path.resolve(this.root, relativePath);
    if (!isInside(this.root, target)) {
      throw vaultError("VAULT_PATH_OUTSIDE_ROOT", "path escapes vault root", { relativePath });
    }
    const parent = path.dirname(target);
    await fs.mkdir(parent, { recursive: true });
    const realRoot = await fs.realpath(this.root);
    const realParent = await fs.realpath(parent);
    if (!isInside(realRoot, realParent) && realRoot !== realParent) {
      throw vaultError("VAULT_PATH_OUTSIDE_ROOT", "path resolves outside vault root", { relativePath });
    }
    try {
      const realTarget = await fs.realpath(target);
      if (!isInside(realRoot, realTarget) && realRoot !== realTarget) {
        throw vaultError("VAULT_PATH_OUTSIDE_ROOT", "target resolves outside vault root", { relativePath });
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    return target;
  }
}

export function validateNoteSize(note) {
  if (note.body.length > note.frontmatter.maxChars) {
    throw vaultError("VAULT_NOTE_TOO_LARGE", "note body exceeds maxChars", {
      relativePath: note.relativePath,
      maxChars: note.frontmatter.maxChars,
      actualChars: note.body.length
    });
  }
}

export function validateHierarchy(notes) {
  const byId = new Map();
  for (const note of notes) {
    if (byId.has(note.frontmatter.id)) {
      throw vaultError("VAULT_HIERARCHY_INVALID", "duplicate note id", { id: note.frontmatter.id });
    }
    byId.set(note.frontmatter.id, note);
  }
  for (const note of notes) {
    const parentId = normalizeMaybeId(note.frontmatter.parent);
    if (parentId && !byId.has(parentId)) {
      throw vaultError("VAULT_HIERARCHY_INVALID", "orphan parent reference", { id: note.frontmatter.id, parentId });
    }
    for (const childId of note.frontmatter.children) {
      const child = byId.get(childId);
      if (!child) throw vaultError("VAULT_HIERARCHY_INVALID", "orphan child reference", { id: note.frontmatter.id, childId });
      if (normalizeMaybeId(child.frontmatter.parent) !== note.frontmatter.id) {
        throw vaultError("VAULT_HIERARCHY_INVALID", "parent and child frontmatter disagree", {
          parentId: note.frontmatter.id,
          childId
        });
      }
      const linkedPaths = new Set([...note.wikilinks, ...child.wikilinks]);
      if (!linkedPaths.has(stripMd(child.relativePath)) && !linkedPaths.has(stripMd(note.relativePath))) {
        throw vaultError("VAULT_HIERARCHY_INVALID", "parent/child frontmatter lacks wikilink agreement", {
          parentId: note.frontmatter.id,
          childId
        });
      }
    }
  }
  detectParentCycles(notes);
}

export function splitCandidate(markdown, { relativePath = "memory/core/core-principles.md" } = {}) {
  const note = parseMarkdownNote(markdown, { relativePath });
  const paragraphs = note.body.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
  const children = paragraphs.map((body, index) => ({
    id: `${note.frontmatter.id}-part-${index + 1}`,
    path: relativePath.replace(/\.md$/u, `-${index + 1}.md`),
    body
  }));
  return {
    parent: relativePath,
    childIds: children.map((child) => child.id),
    children
  };
}

async function markdownFiles(root) {
  const files = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const current = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== ".obsidian") await visit(current);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".md")) files.push(current);
    }
  }
  await visit(root);
  return files.sort();
}

function noteIndexEntry(note) {
  return {
    id: note.frontmatter.id,
    path: note.relativePath,
    title: note.title,
    tags: note.frontmatter.tags,
    importance: note.frontmatter.importance,
    recallPolicyRef: note.frontmatter.recallPolicyRef,
    links: note.frontmatter.links,
    wikilinks: note.wikilinks,
    summary: note.frontmatter.summary,
    body: note.body
  };
}

function filterNotes(notes, { query, tag }) {
  const normalizedQuery = query.trim().toLowerCase();
  return notes.filter((note) => {
    const tagOk = !tag || note.tags.includes(tag);
    const queryOk = !normalizedQuery || [
      note.title,
      note.summary,
      note.body,
      note.path,
      ...note.wikilinks
    ].some((value) => String(value).toLowerCase().includes(normalizedQuery));
    return tagOk && queryOk;
  });
}

function detectParentCycles(notes) {
  const parentById = new Map(notes.map((note) => [note.frontmatter.id, normalizeMaybeId(note.frontmatter.parent)]));
  for (const note of notes) {
    const seen = new Set();
    let current = note.frontmatter.id;
    while (current) {
      if (seen.has(current)) throw vaultError("VAULT_HIERARCHY_INVALID", "parent cycle detected", { id: note.frontmatter.id });
      seen.add(current);
      current = parentById.get(current);
    }
  }
}

function normalizeMaybeId(value) {
  return value === null || value === "" || value === undefined ? "" : String(value);
}

function stripMd(value) {
  return value.replace(/\.md$/u, "");
}

function toVaultRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function atomicWriteJson(filePath, value) {
  await atomicWriteText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function atomicWriteText(filePath, text) {
  const tmpPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}-${process.pid}-${Date.now()}-tmp`);
  try {
    await fs.writeFile(tmpPath, text, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }
}
