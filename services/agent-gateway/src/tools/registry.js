import { createBuiltInTools } from "./builtins.js";
import { ToolExecutionError } from "./errors.js";

export class ToolRegistry {
  #tools = new Map();

  register(tool) {
    if (!tool?.name) throw new Error("tool.name is required");
    if (this.#tools.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    this.#tools.set(tool.name, tool);
    return tool;
  }

  get(name) {
    return this.#tools.get(name);
  }

  list() {
    return [...this.#tools.values()];
  }

  specs() {
    return this.list().map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  async execute(name, args, context) {
    const tool = this.get(name);
    if (!tool) {
      throw new ToolExecutionError(`Unknown tool: ${name}`, {
        code: "TOOL_NOT_FOUND",
        details: { toolName: name }
      });
    }
    return tool.execute(args, context);
  }
}

export function createDefaultToolRegistry(options = {}) {
  const registry = new ToolRegistry();
  for (const tool of createBuiltInTools(options)) registry.register(tool);
  return registry;
}
