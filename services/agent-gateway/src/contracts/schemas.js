export const CONTRACT_NAMES = [
  "sttTranscript",
  "exaoneNormalizedInput",
  "exaoneNormalizedOutput",
  "recallPolicy",
  "expressionMemory",
  "reasoningMemory",
  "workflowCandidate",
  "publishRecord",
  "rollbackRecord",
  "gguiWorkbenchEvent"
];

const requiredString = { type: "string", minLength: 1 };

export const contractSchemas = {
  sttTranscript: objectSchema({
    id: requiredString,
    text: requiredString,
    language: requiredString,
    confidence: { type: "number" },
    segments: arrayOf(objectSchema({
      startMs: { type: "number" },
      endMs: { type: "number" },
      text: requiredString,
      confidence: { type: "number" }
    }, ["startMs", "endMs", "text"])),
    provider: requiredString,
    model: requiredString
  }, ["id", "text", "language", "confidence", "segments"]),
  exaoneNormalizedInput: objectSchema({
    id: requiredString,
    transcriptId: requiredString,
    normalizedText: requiredString,
    language: requiredString,
    emotionalHints: { type: "object" },
    sensitiveSpans: { type: "array" }
  }, ["id", "transcriptId", "normalizedText", "language"]),
  exaoneNormalizedOutput: objectSchema({
    id: requiredString,
    rationalResultId: requiredString,
    utterance: requiredString,
    language: requiredString,
    tone: requiredString,
    uiCopy: { type: "array" },
    safetyNotes: { type: "array" }
  }, ["id", "rationalResultId", "utterance", "language", "tone"]),
  recallPolicy: objectSchema({
    id: requiredString,
    version: { type: "number" },
    rules: arrayOf(objectSchema({
      intent: requiredString,
      priority: { type: "number" },
      conditions: arrayOf(requiredString),
      recall: arrayOf(requiredString),
      requiredConfirmation: { type: "boolean" }
    }, ["intent", "priority", "conditions", "recall"])),
    invariants: arrayOf(requiredString)
  }, ["id", "version", "rules", "invariants"]),
  expressionMemory: objectSchema({
    id: requiredString,
    userPreferences: { type: "object" },
    avoidedPhrases: { type: "array" },
    updatedAt: requiredString
  }, ["id", "userPreferences", "updatedAt"]),
  reasoningMemory: objectSchema({
    id: requiredString,
    facts: { type: "array" },
    failurePatterns: { type: "array" },
    toolPreferences: { type: "array" },
    updatedAt: requiredString
  }, ["id", "facts", "failurePatterns", "toolPreferences", "updatedAt"]),
  workflowCandidate: objectSchema({
    id: requiredString,
    versionName: requiredString,
    reason: requiredString,
    changed: arrayOf(requiredString),
    patches: objectSchema({
      localWorkflowRegistry: objectSchema({
        operations: arrayOf(objectSchema({
          op: { type: "string", enum: ["add", "replace", "remove"] },
          path: requiredString,
          value: {}
        }, ["op", "path"]))
      }, ["operations"]),
      localWorkflowYaml: requiredString
    }, ["localWorkflowRegistry", "localWorkflowYaml"]),
    smokeTests: arrayOf(objectSchema({
      name: requiredString,
      input: requiredString,
      expected: requiredString
    }, ["name", "input", "expected"]))
  }, ["id", "versionName", "reason", "changed", "patches", "smokeTests"]),
  publishRecord: objectSchema({
    id: requiredString,
    candidateId: requiredString,
    versionName: requiredString,
    actor: requiredString,
    publishedAt: requiredString,
    tests: arrayOf(requiredString),
    changed: arrayOf(requiredString),
    rollback: requiredString
  }, ["id", "candidateId", "versionName", "actor", "publishedAt", "tests", "changed", "rollback"]),
  rollbackRecord: objectSchema({
    id: requiredString,
    fromVersionId: requiredString,
    toVersionId: requiredString,
    actor: requiredString,
    reason: requiredString,
    rolledBackAt: requiredString
  }, ["id", "fromVersionId", "toVersionId", "actor", "reason", "rolledBackAt"]),
  gguiWorkbenchEvent: objectSchema({
    type: requiredString,
    workflowId: requiredString,
    nodeId: requiredString,
    patch: { type: "object" }
  }, ["type", "workflowId", "nodeId", "patch"])
};

export class ContractValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "ContractValidationError";
    this.code = "REGISTRY_VALIDATION_FAILED";
    this.details = details;
  }
}

export function validateContract(name, value) {
  const schema = contractSchemas[name];
  if (!schema) {
    throw new ContractValidationError(`Unknown contract: ${name}`, { contractName: name, path: "$" });
  }
  validateSchema(schema, value, { contractName: name, path: "$" });
  return value;
}

export function validateRegistryCandidate(candidate) {
  assertPlainObject(candidate, { contractName: "registryCandidate", path: "$" });
  for (const key of ["id", "versionName", "reason", "changed", "contracts"]) {
    if (candidate[key] === undefined) {
      throw validationError("registryCandidate", `$/${key}`, "is required");
    }
  }
  if (!Array.isArray(candidate.changed)) {
    throw validationError("registryCandidate", "$/changed", "must be an array");
  }
  assertPlainObject(candidate.contracts, { contractName: "registryCandidate", path: "$/contracts" });
  for (const name of Object.keys(candidate.contracts)) {
    validateContract(name, candidate.contracts[name]);
  }
  if (candidate.contracts.workflowCandidate === undefined) {
    throw validationError("registryCandidate", "$/contracts/workflowCandidate", "is required");
  }
  return candidate;
}

function objectSchema(properties, required = []) {
  return { type: "object", properties, required };
}

function arrayOf(items) {
  return { type: "array", items };
}

function validateSchema(schema, value, details) {
  if (!schema?.type && !schema?.required && !schema?.properties && !schema?.items && !schema?.enum) return;
  if (schema.type === "object") {
    assertPlainObject(value, details);
    for (const key of schema.required ?? []) {
      if (value[key] === undefined) throw validationError(details.contractName, `${details.path}/${key}`, "is required");
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (value[key] !== undefined) {
        validateSchema(childSchema, value[key], { ...details, path: `${details.path}/${key}` });
      }
    }
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) throw validationError(details.contractName, details.path, "must be an array");
    for (const [index, item] of value.entries()) {
      validateSchema(schema.items, item, { ...details, path: `${details.path}/${index}` });
    }
    return;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") throw validationError(details.contractName, details.path, "must be a string");
    if (schema.minLength && value.length < schema.minLength) {
      throw validationError(details.contractName, details.path, `must be at least ${schema.minLength} characters`);
    }
  } else if (schema.type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw validationError(details.contractName, details.path, "must be a number");
    }
  } else if (schema.type === "boolean" && typeof value !== "boolean") {
    throw validationError(details.contractName, details.path, "must be a boolean");
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw validationError(details.contractName, details.path, `must be one of ${schema.enum.join(", ")}`);
  }
}

function assertPlainObject(value, details) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(details.contractName, details.path, "must be an object");
  }
}

function validationError(contractName, path, message) {
  return new ContractValidationError(`${contractName} ${path} ${message}`, { contractName, path, message });
}
