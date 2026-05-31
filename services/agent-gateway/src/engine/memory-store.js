import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class ConversationMemoryError extends Error {
  constructor(message, { code = "CONVERSATION_MEMORY_ERROR", conversationId, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ConversationMemoryError";
    this.code = code;
    this.conversationId = conversationId;
  }
}

export function createFileConversationMemoryStore({ rootPath = ".oppa/conversations" } = {}) {
  const locks = new Map();
  return {
    rootPath,
    read(conversationId) {
      return readMemory(rootPath, conversationId);
    },
    update(conversationId, updater) {
      const previous = locks.get(conversationId) || Promise.resolve();
      const next = previous.then(() => updateMemory(rootPath, conversationId, updater));
      locks.set(conversationId, next.catch(() => {}));
      return next.finally(() => {
        if (locks.get(conversationId) === next) locks.delete(conversationId);
      });
    },
    pathFor(conversationId) {
      return conversationDir(rootPath, conversationId);
    }
  };
}

export function redactMemoryText(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gu, "Bearer [redacted]")
    .replace(/(api[_-]?key|password|token)\s*[:=]\s*['"]?[^\s,'"]+/giu, "$1=[redacted]");
}

async function readMemory(rootPath, conversationId) {
  if (!conversationId) return emptyMemory(conversationId);
  const dir = conversationDir(rootPath, conversationId);
  const manifestPath = path.join(dir, "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8").catch((cause) => {
    if (cause?.code === "ENOENT") return "";
    throw cause;
  });
  if (!raw) return emptyMemory(conversationId);
  try {
    return normalizeMemory(JSON.parse(raw), conversationId);
  } catch (cause) {
    throw new ConversationMemoryError("conversation memory manifest is corrupt", {
      code: "CONVERSATION_MEMORY_CORRUPT",
      conversationId,
      cause
    });
  }
}

async function updateMemory(rootPath, conversationId, updater) {
  if (!conversationId) return emptyMemory(conversationId);
  const dir = conversationDir(rootPath, conversationId);
  await fs.mkdir(dir, { recursive: true });
  const lockPath = path.join(dir, "conversation.lock");
  await fs.writeFile(lockPath, `${process.pid}:${Date.now()}`, "utf8");
  try {
    const current = await readMemory(rootPath, conversationId);
    const updated = normalizeMemory(await updater(current), conversationId);
    updated.revision = current.revision + 1;
    updated.updatedAt = new Date().toISOString();
    await appendJournal(dir, current, updated);
    await writeJsonAtomic(path.join(dir, "manifest.json"), updated);
    return updated;
  } finally {
    await fs.rm(lockPath, { force: true });
  }
}

async function appendJournal(dir, before, after) {
  const entry = {
    at: after.updatedAt,
    revision: after.revision,
    beforeRevision: before.revision,
    turnCount: after.turns.length,
    summaryTokensApprox: Math.ceil(String(after.summary || "").length / 4)
  };
  await fs.appendFile(path.join(dir, "journal.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
}

async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

function normalizeMemory(value, conversationId) {
  return {
    conversationId,
    revision: Number.isInteger(value?.revision) ? value.revision : 0,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null,
    summary: redactMemoryText(value?.summary || ""),
    turns: Array.isArray(value?.turns)
      ? value.turns.map(normalizeTurn).filter(Boolean)
      : [],
    compactedAt: typeof value?.compactedAt === "string" ? value.compactedAt : null
  };
}

function normalizeTurn(turn) {
  if (!turn || typeof turn !== "object") return null;
  return {
    at: typeof turn.at === "string" ? turn.at : new Date().toISOString(),
    user: redactMemoryText(turn.user || ""),
    assistant: redactMemoryText(turn.assistant || "")
  };
}

function emptyMemory(conversationId) {
  return {
    conversationId,
    revision: 0,
    updatedAt: null,
    summary: "",
    turns: [],
    compactedAt: null
  };
}

function conversationDir(rootPath, conversationId) {
  const digest = crypto.createHash("sha256").update(String(conversationId)).digest("hex").slice(0, 16);
  const slug = String(conversationId)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48) || "conversation";
  return path.resolve(rootPath, `${slug}-${digest}`);
}
