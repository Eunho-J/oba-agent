export class ToolExecutionError extends Error {
  constructor(message, { code = "TOOL_EXECUTION_FAILED", cause, details } = {}) {
    super(message, { cause });
    this.name = "ToolExecutionError";
    this.code = code;
    this.details = details;
  }
}

export function toErrorPayload(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
    code: error?.code || "ERROR",
    stack: error?.stack || "",
    cause: formatCause(error?.cause),
    details: error?.details
  };
}

function formatCause(cause) {
  if (!cause) return undefined;
  return {
    name: cause.name || "Error",
    message: cause.message || String(cause),
    stack: cause.stack || ""
  };
}
