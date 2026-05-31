import fs from "node:fs/promises";
import path from "node:path";
import { validateRegistryCandidate } from "../contracts/schemas.js";

export class RegistryError extends Error {
  constructor(message, { code, cause, details } = {}) {
    super(message, { cause });
    this.name = "RegistryError";
    this.code = code ?? "REGISTRY_ERROR";
    this.details = details;
  }
}

export class FileRegistry {
  constructor({ root = process.cwd(), lockHoldMs = 25 } = {}) {
    this.root = path.resolve(root);
    this.registryRoot = path.join(this.root, ".oppa", "registry");
    this.candidatesRoot = path.join(this.registryRoot, "candidates");
    this.snapshotsRoot = path.join(this.registryRoot, "snapshots");
    this.activePath = path.join(this.registryRoot, "active.json");
    this.journalPath = path.join(this.registryRoot, "journal.ndjson");
    this.lockPath = path.join(this.registryRoot, "registry.lock");
    this.lockHoldMs = lockHoldMs;
  }

  async writeCandidate(candidate) {
    validateRegistryCandidate(candidate);
    await this.#ensureLayout();
    await atomicWriteJson(path.join(this.candidatesRoot, `${candidate.id}.json`), candidate);
    await this.#appendJournal({ type: "candidate.write", candidateId: candidate.id });
    return candidate;
  }

  async activateCandidate(candidateId, { actor = "agent", reason = "" } = {}) {
    const { active } = await this.publishCandidate(candidateId, { actor, reason });
    await this.#appendJournal({ type: "candidate.activate", candidateId, actor, reason });
    return active;
  }

  async publishCandidate(candidateId, { actor = "agent", reason = "" } = {}) {
    await this.#ensureLayout();
    return this.#withLock(async () => {
      if (this.lockHoldMs > 0) await sleep(this.lockHoldMs);
      const candidate = validateRegistryCandidate(await this.#readCandidate(candidateId));
      const previousActive = await this.#readActiveIfExists();
      const previousActiveId = previousActive?.id ?? null;
      const snapshotId = await this.#snapshotActiveIfPresent(previousActive);
      await atomicWriteJson(this.activePath, candidate);
      await this.#appendJournal({ type: "candidate.publish", candidateId, actor, reason, snapshotId });
      return { active: candidate, snapshotId, previousActiveId };
    });
  }

  async rollbackToSnapshot(snapshotId, { actor = "agent", reason = "" } = {}) {
    await this.#ensureLayout();
    return this.#withLock(async () => {
      if (this.lockHoldMs > 0) await sleep(this.lockHoldMs);
      const restoredCandidate = validateRegistryCandidate(await this.#readSnapshot(snapshotId));
      const currentActive = await this.#readActiveIfExists();
      const fromVersionId = currentActive?.id ?? null;
      const toVersionId = restoredCandidate.id;
      await atomicWriteJson(this.activePath, restoredCandidate);
      await this.#appendJournal({
        type: "candidate.rollback",
        snapshotId,
        actor,
        reason,
        fromVersionId,
        toVersionId
      });
      return { active: restoredCandidate, fromVersionId, toVersionId };
    });
  }

  async readActive() {
    return validateRegistryCandidate(JSON.parse(await fs.readFile(this.activePath, "utf8")));
  }

  async #readCandidate(candidateId) {
    const candidatePath = path.join(this.candidatesRoot, `${candidateId}.json`);
    return JSON.parse(await fs.readFile(candidatePath, "utf8"));
  }

  async #readSnapshot(snapshotId) {
    const snapshotPath = path.join(this.snapshotsRoot, `${snapshotId}.json`);
    return JSON.parse(await fs.readFile(snapshotPath, "utf8"));
  }

  async #readActiveIfExists() {
    try {
      return validateRegistryCandidate(JSON.parse(await fs.readFile(this.activePath, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async #snapshotActiveIfPresent(activeCandidate) {
    if (!activeCandidate) {
      return null;
    }
    const snapshotId = `${sanitizeId(activeCandidate.id)}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    await atomicWriteJson(path.join(this.snapshotsRoot, `${snapshotId}.json`), activeCandidate);
    return snapshotId;
  }

  async #ensureLayout() {
    await fs.mkdir(this.candidatesRoot, { recursive: true });
    await fs.mkdir(this.snapshotsRoot, { recursive: true });
  }

  async #appendJournal(entry) {
    await fs.appendFile(this.journalPath, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`, "utf8");
  }

  async #withLock(fn) {
    let handle;
    try {
      handle = await fs.open(this.lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new RegistryError("registry is locked", { code: "REGISTRY_LOCKED", cause: error });
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeId(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_");
}
