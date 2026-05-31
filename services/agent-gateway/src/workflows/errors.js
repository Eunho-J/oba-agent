export class WorkflowValidationError extends Error {
  constructor(message, { code = "WORKFLOW_VALIDATION_FAILED", details, cause } = {}) {
    super(message, { cause });
    this.name = "WorkflowValidationError";
    this.code = code;
    this.details = details;
  }
}

export function workflowError(message, details) {
  return new WorkflowValidationError(message, { details });
}

export function nodeNotInMvpError(type, details) {
  return new WorkflowValidationError(`node type ${type} is not in the MVP catalog`, {
    code: "WORKFLOW_NODE_NOT_IN_MVP",
    details
  });
}
