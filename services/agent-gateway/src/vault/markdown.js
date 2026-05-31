import { parseDocument } from "yaml";
import { vaultError } from "./errors.js";

export const REQUIRED_FRONTMATTER = [
  "id",
  "type",
  "tags",
  "createdAt",
  "updatedAt",
  "source",
  "links",
  "importance",
  "recallPolicyRef",
  "maxChars",
  "splitBy",
  "parent",
  "children",
  "summary"
];

const IMPORTANCE_VALUES = new Set(["core", "high", "normal", "low"]);
const SPLIT_BY_VALUES = new Set(["heading", "paragraph", "manual", "wikilink"]);

export function parseMarkdownNote(text, { relativePath = "<inline>" } = {}) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(text);
  if (!match) {
    throw vaultError("VAULT_FRONTMATTER_INVALID", "note must start with YAML frontmatter", { relativePath });
  }
  const frontmatter = parseFrontmatter(match[1], relativePath);
  validateFrontmatter(frontmatter, relativePath);
  const body = match[2] ?? "";
  return {
    relativePath,
    frontmatter,
    body,
    title: extractTitle(body, relativePath),
    wikilinks: extractWikilinks(body)
  };
}

export function parseFrontmatter(source, relativePath) {
  const document = parseDocument(source, { prettyErrors: false, strict: true, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw vaultError("VAULT_FRONTMATTER_INVALID", document.errors[0].message, { relativePath });
  }
  const value = document.toJS();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw vaultError("VAULT_FRONTMATTER_INVALID", "frontmatter must be an object", { relativePath });
  }
  return value;
}

export function validateFrontmatter(frontmatter, relativePath) {
  for (const key of REQUIRED_FRONTMATTER) {
    if (frontmatter[key] === undefined) {
      throw vaultError("VAULT_FRONTMATTER_INVALID", `${key} is required`, { relativePath, key });
    }
  }
  if (!Array.isArray(frontmatter.tags) || !Array.isArray(frontmatter.links) || !Array.isArray(frontmatter.children)) {
    throw vaultError("VAULT_FRONTMATTER_INVALID", "tags, links, and children must be arrays", { relativePath });
  }
  if (!IMPORTANCE_VALUES.has(frontmatter.importance)) {
    throw vaultError("VAULT_FRONTMATTER_INVALID", "importance is invalid", { relativePath });
  }
  if (!SPLIT_BY_VALUES.has(frontmatter.splitBy)) {
    throw vaultError("VAULT_FRONTMATTER_INVALID", "splitBy is invalid", { relativePath });
  }
  if (!Number.isInteger(frontmatter.maxChars) || frontmatter.maxChars < 1) {
    throw vaultError("VAULT_FRONTMATTER_INVALID", "maxChars must be a positive integer", { relativePath });
  }
  if (String(relativePath).startsWith("memory/core/") && frontmatter.importance !== "core") {
    throw vaultError("VAULT_FRONTMATTER_INVALID", "memory/core notes must use importance: core", { relativePath });
  }
}

export function extractWikilinks(body) {
  const links = [];
  const pattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gu;
  for (const match of body.matchAll(pattern)) links.push(match[1].trim());
  return links;
}

function extractTitle(body, relativePath) {
  const heading = body.match(/^#\s+(.+)$/mu);
  if (heading) return heading[1].trim();
  return relativePath.split("/").at(-1)?.replace(/\.md$/u, "") ?? relativePath;
}
