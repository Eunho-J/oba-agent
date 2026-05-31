import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ApiFuseGuardError,
  confirmationConsumedError,
  confirmationRequiredError
} from "./errors.js";

export class ConfirmationTokenStore {
  constructor({ root = process.cwd() } = {}) {
    this.root = path.resolve(root);
    this.storeDir = path.join(this.root, ".oppa", "apifuse");
    this.storePath = path.join(this.storeDir, "confirmation-tokens.json");
    this.lockPath = path.join(this.storeDir, "confirmation-tokens.lock");
  }

  async createToken({
    providerId,
    operationId,
    body = {},
    now = new Date(),
    expiresAt = null
  }) {
    await this.#ensureLayout();
    const record = {
      id: createTokenId(),
      providerId,
      operationId,
      bodyHash: hashBody(body),
      consumed: false,
      createdAt: now.toISOString(),
      consumedAt: null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    };
    await this.#withLock(async () => {
      const state = await this.#readState();
      state.tokens[record.id] = record;
      await atomicWriteJson(this.storePath, state);
    });
    return record;
  }

  async consumeTokenForAction({
    tokenId,
    providerId,
    operationId,
    body = {},
    now = new Date()
  }) {
    await this.#ensureLayout();
    return this.#withLock(async () => {
      const state = await this.#readState();
      const record = state.tokens[tokenId];
      if (!record) {
        throw confirmationRequiredError("valid confirmation token is required", {
          tokenId,
          providerId,
          operationId
        });
      }
      if (record.consumed) {
        throw confirmationConsumedError("confirmation token has already been consumed", {
          tokenId,
          providerId,
          operationId
        });
      }
      if (record.expiresAt && Date.parse(record.expiresAt) < now.getTime()) {
        throw confirmationRequiredError("confirmation token expired; prepare action again", {
          tokenId,
          providerId,
          operationId
        });
      }

      const bodyHash = hashBody(body);
      if (
        record.providerId !== providerId
        || record.operationId !== operationId
        || record.bodyHash !== bodyHash
      ) {
        throw confirmationRequiredError("confirmation token does not match requested action", {
          tokenId,
          providerId,
          operationId
        });
      }

      const consumedRecord = {
        ...record,
        consumed: true,
        consumedAt: now.toISOString()
      };
      state.tokens[tokenId] = consumedRecord;
      await atomicWriteJson(this.storePath, state);
      return consumedRecord;
    });
  }

  async readToken(tokenId) {
    const state = await this.#readState();
    return state.tokens[tokenId] || null;
  }

  async #ensureLayout() {
    await fs.mkdir(this.storeDir, { recursive: true });
  }

  async #readState() {
    try {
      const raw = await fs.readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("token store state must be an object");
      }
      if (!parsed.tokens || typeof parsed.tokens !== "object" || Array.isArray(parsed.tokens)) {
        throw new Error("token store state must include tokens map");
      }
      return parsed;
    } catch (error) {
      if (error?.code === "ENOENT") {
        return { version: 1, tokens: {} };
      }
      if (error instanceof SyntaxError) {
        throw new ApiFuseGuardError("failed to parse confirmation token store", {
          code: "TOKEN_STORE_INVALID",
          status: 500,
          cause: error
        });
      }
      throw error;
    }
  }

  async #withLock(fn) {
    let handle;
    try {
      handle = await fs.open(this.lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new ApiFuseGuardError("confirmation token store is locked", {
          code: "TOKEN_STORE_LOCKED",
          status: 503,
          cause: error
        });
      }
      throw error;
    }

    try {
      return await fn();
    } finally {
      await handle?.close();
      await fs.rm(this.lockPath, { force: true });
    }
  }
}

function createTokenId() {
  return `actconf_${crypto.randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

function hashBody(body) {
  return crypto.createHash("sha256").update(stableStringify(normalizeBody(body))).digest("hex");
}

function normalizeBody(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeBody(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalizeBody(value[key])])
  );
}

function stableStringify(value) {
  return JSON.stringify(value ?? {});
}

async function atomicWriteJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}-${process.pid}-${Date.now()}-tmp-${Math.random().toString(16).slice(2)}`);
  try {
    await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }
}
