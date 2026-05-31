import { workflowError } from "./errors.js";
import { asString, deepGet, parseCondition } from "./runtime-utils.js";

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /(?<=api[_-]?key["'\s:=]{1,8})[A-Za-z0-9_-]{8,}/gi,
  /(?<=token["'\s:=]{1,8})[A-Za-z0-9_.-]{8,}/gi
];

export function executeSafetyNode(node, { inputs, runtimeInput }) {
  const config = node.config ?? {};
  switch (node.type) {
    case "safety.requireConfirmation":
      return emit(node, { required: true, message: config.message ?? "confirmation required", value: inputs.value ?? null });
    case "safety.validateSchema":
      validateRequiredKeys(inputs.value ?? inputs.object ?? {}, config.schema);
      return emit(node, { valid: true, value: inputs.value ?? inputs.object ?? null });
    case "safety.validateInvariants":
      validateInvariants(config.invariants ?? [], { ...runtimeInput, ...inputs });
      return emit(node, { valid: true, value: inputs.value ?? null });
    case "safety.redactSecrets":
      return emit(node, { text: redact(asString(inputs.text ?? inputs.value ?? "")) });
    default:
      return {};
  }
}

function validateRequiredKeys(value, schema = {}) {
  for (const key of schema.required ?? []) {
    if (deepGet(value, key) === undefined) throw workflowError(`schema required key missing: ${key}`, { key });
  }
}

function validateInvariants(invariants, context) {
  for (const invariant of invariants) {
    if (!parseCondition(invariant, context)) throw workflowError(`invariant failed: ${invariant}`, { invariant });
  }
}

function redact(text) {
  let result = text;
  for (const pattern of SECRET_PATTERNS) result = result.replace(pattern, "[REDACTED]");
  return result;
}

function emit(node, values) {
  const declared = Object.keys(node.outputs ?? {});
  if (declared.length === 0) return values;
  return Object.fromEntries(Object.entries(values).filter(([key]) => declared.includes(key)));
}
