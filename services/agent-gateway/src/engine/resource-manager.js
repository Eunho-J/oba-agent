import fs from "node:fs/promises";

export class TurnAbortError extends Error {
  constructor(message, { code = "TURN_ABORTED", cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "TurnAbortError";
    this.code = code;
  }
}

export class TurnResourceManager {
  constructor({ timeoutMs = 30000 } = {}) {
    this.controller = new AbortController();
    this.timeoutMs = timeoutMs;
    this.timers = new Set();
    this.cleanupTasks = [];
    this.tempPaths = new Set();
    this.cleaned = false;
    this.abortReason = null;
    if (timeoutMs > 0) {
      const timer = setTimeout(() => {
        this.abort(new TurnAbortError(`turn timed out after ${timeoutMs}ms`, {
          code: "TURN_TIMEOUT"
        }));
      }, timeoutMs);
      this.timers.add(timer);
    }
  }

  get signal() {
    return this.controller.signal;
  }

  abort(reason = new TurnAbortError("turn aborted")) {
    this.abortReason = reason;
    if (!this.controller.signal.aborted) {
      this.controller.abort(reason);
    }
  }

  registerCleanup(cleanup) {
    if (typeof cleanup === "function") this.cleanupTasks.push(cleanup);
  }

  registerTempPath(tempPath) {
    if (tempPath) {
      this.tempPaths.add(tempPath);
      this.registerCleanup(() => fs.rm(tempPath, { recursive: true, force: true }));
    }
  }

  async cleanup() {
    if (this.cleaned) return this.report();
    this.cleaned = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    const cleanupErrors = [];
    for (const cleanup of this.cleanupTasks.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        cleanupErrors.push({
          message: error?.message || String(error),
          code: error?.code
        });
      }
    }
    this.cleanupErrors = cleanupErrors;
    return this.report();
  }

  report() {
    return {
      aborted: this.signal.aborted,
      abortCode: this.abortReason?.code,
      timeoutMs: this.timeoutMs,
      activeTimers: this.timers.size,
      tempPaths: Array.from(this.tempPaths),
      cleaned: this.cleaned,
      cleanupErrors: this.cleanupErrors || []
    };
  }
}
