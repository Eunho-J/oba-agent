import { spawn } from "node:child_process";
import { createLogger, serializeError } from "./logger.js";

export function createSafeHookRunner({ hooks = [], logger = createLogger() } = {}) {
  const normalizedHooks = hooks.map((hook, index) => normalizeHook(hook, index));
  return {
    async run(event, payload = {}) {
      const diagnostics = [];
      for (const hook of normalizedHooks.filter((candidate) => candidate.event === event)) {
        diagnostics.push(await runHook(hook, payload, logger));
      }
      return diagnostics;
    }
  };
}

export async function runHooksSafely(hookRunner, event, payload, { logger = createLogger() } = {}) {
  if (!hookRunner?.run) return [];
  try {
    const diagnostics = await hookRunner.run(event, payload);
    return Array.isArray(diagnostics) ? diagnostics : [];
  } catch (error) {
    const diagnostic = {
      type: "hook.error",
      event,
      hookId: "hook-runner",
      status: "diagnostic",
      failurePolicy: "diagnostic",
      error: serializeError(error)
    };
    logger.event("hook.runner.error", { level: "error", event, error: diagnostic.error });
    return [diagnostic];
  }
}

function normalizeHook(hook, index) {
  const id = asNonEmptyString(hook?.id) || `hook-${index + 1}`;
  const event = asNonEmptyString(hook?.event) || "turn.after";
  const command = asNonEmptyString(hook?.command);
  const args = Array.isArray(hook?.args) ? hook.args.map(String) : [];
  const timeoutMs = positiveInteger(hook?.timeoutMs, 1000);
  const failurePolicy = hook?.failurePolicy === "diagnostic" ? "diagnostic" : "diagnostic";
  return { id, event, command, args, timeoutMs, failurePolicy };
}

async function runHook(hook, payload, logger) {
  if (!hook.command) {
    return {
      type: "hook.skipped",
      event: hook.event,
      hookId: hook.id,
      status: "skipped",
      failurePolicy: hook.failurePolicy,
      message: "hook command is not configured"
    };
  }
  const startedAt = Date.now();
  try {
    const result = await runCommandHook(hook, payload);
    const diagnostic = {
      type: result.exitCode === 0 ? "hook.ok" : "hook.error",
      event: hook.event,
      hookId: hook.id,
      status: result.exitCode === 0 ? "ok" : "diagnostic",
      failurePolicy: hook.failurePolicy,
      exitCode: result.exitCode,
      signal: result.signal,
      stdout: preview(result.stdout),
      stderr: preview(result.stderr),
      durationMs: Date.now() - startedAt
    };
    if (diagnostic.status === "diagnostic") {
      logger.event("hook.diagnostic", { level: "error", hookId: hook.id, event: hook.event, diagnostic });
    }
    return diagnostic;
  } catch (error) {
    const diagnostic = {
      type: "hook.error",
      event: hook.event,
      hookId: hook.id,
      status: "diagnostic",
      failurePolicy: hook.failurePolicy,
      error: serializeError(error),
      durationMs: Date.now() - startedAt
    };
    logger.event("hook.diagnostic", { level: "error", hookId: hook.id, event: hook.event, diagnostic });
    return diagnostic;
  }
}

function runCommandHook(hook, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(hook.command, hook.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, OBA_HOOK_EVENT: hook.event, OBA_HOOK_ID: hook.id }
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, hook.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: timedOut ? 124 : exitCode,
        signal,
        stdout,
        stderr: timedOut ? `${stderr}\nhook timed out after ${hook.timeoutMs}ms`.trim() : stderr
      });
    });
    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function preview(value) {
  const text = String(value || "");
  return text.length > 1000 ? `${text.slice(0, 1000)}...` : text;
}
