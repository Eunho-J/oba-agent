import fs from "node:fs/promises";
import path from "node:path";
import { runWorkflow } from "./runner.js";
import { validateWorkflowYaml } from "./validate.js";

export async function runGatewayWorkflow(body, { root = process.cwd() } = {}) {
  validateBody(body);
  const workflowPath = await safeWorkflowPath(root, body.workflowPath);
  const source = await fs.readFile(workflowPath, "utf8");
  const workflow = validateWorkflowYaml(source, { filePath: workflowPath });
  return runWorkflow({
    workflow,
    input: body.input ?? {}
  });
}

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw requestError("request body must be a JSON object");
  }
  if (typeof body.workflowPath !== "string" || body.workflowPath.trim().length === 0) {
    throw requestError("workflowPath must be a non-empty string");
  }
  if (body.input !== undefined && (!body.input || typeof body.input !== "object" || Array.isArray(body.input))) {
    throw requestError("input must be a JSON object");
  }
}

async function safeWorkflowPath(root, relativePath) {
  if (path.isAbsolute(relativePath)) throw requestError("workflowPath must be relative");
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relativePath);
  const relative = path.relative(absoluteRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw requestError("workflowPath escapes workspace root");
  return target;
}

function requestError(message) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.status = 400;
  return error;
}
