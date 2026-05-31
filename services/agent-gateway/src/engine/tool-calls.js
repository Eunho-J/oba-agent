import { stableHash } from "./ids.js";
import { ToolExecutionError } from "../tools/errors.js";

export function extractAssistantMessage(response) {
  const message = response?.choices?.[0]?.message;
  if (!message) {
    throw new ToolExecutionError("Provider response did not include choices[0].message", {
      code: "PROVIDER_RESPONSE_INVALID",
      details: { responseShape: Object.keys(response || {}) }
    });
  }
  return message;
}

export function parseToolCalls(message) {
  return (message.tool_calls || []).map((call) => {
    const id = call.id;
    const name = call.function?.name;
    const rawArguments = call.function?.arguments || "{}";
    if (!id || !name) {
      throw new ToolExecutionError("Tool call id and function name are required", {
        code: "TOOL_CALL_INVALID",
        details: { id, name }
      });
    }
    try {
      const args = JSON.parse(rawArguments);
      return {
        id,
        name,
        args,
        argsHash: stableHash(args),
        rawArguments
      };
    } catch (cause) {
      throw new ToolExecutionError("Tool call arguments were not valid JSON", {
        code: "TOOL_ARGUMENT_JSON_INVALID",
        cause,
        details: { id, name, rawArguments }
      });
    }
  });
}

export function toolResultMessage(call, result) {
  return {
    role: "tool",
    tool_call_id: call.id,
    name: call.name,
    content: JSON.stringify(result)
  };
}
