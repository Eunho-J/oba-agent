import { parseDocument } from "yaml";
import { WorkflowValidationError, workflowError } from "./errors.js";

export function parseWorkflowYaml(source, { filePath = "<inline>" } = {}) {
  const document = parseDocument(source, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    throw new WorkflowValidationError(`workflow YAML parse failed: ${document.errors[0].message}`, {
      details: { filePath, errors: document.errors.map((error) => error.message) }
    });
  }
  if (document.warnings.length > 0) {
    throw new WorkflowValidationError(`workflow YAML warning treated as error: ${document.warnings[0].message}`, {
      details: { filePath, warnings: document.warnings.map((warning) => warning.message) }
    });
  }
  const value = document.toJS({ maxAliasCount: 32 });
  assertPlainObject(value, "$");
  return value;
}

export function assertPlainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw workflowError(`${path} must be an object`, { path });
  }
}

export function assertArray(value, path) {
  if (!Array.isArray(value)) throw workflowError(`${path} must be an array`, { path });
}

export function assertString(value, path) {
  if (typeof value !== "string" || value.length === 0) {
    throw workflowError(`${path} must be a non-empty string`, { path });
  }
}

export function assertOptionalObject(value, path) {
  if (value === undefined) return;
  assertPlainObject(value, path);
}
