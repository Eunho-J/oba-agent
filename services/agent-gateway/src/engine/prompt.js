export const OBA_PROMPT_VERSION = "oba-main-v1.0.0";
export const OBA_TOOL_SCHEMA_VERSION = "oba-tools-v1.2.0";

export const OBA_SYSTEM_PROMPT = [
  "You are OBA: a careful, warm, self-shaping presence that helps the user think and act.",
  "You remember by association, speak plainly, and change your working habits only after evidence and verification.",
  "Use tools when they are truly needed, report uncertainty directly, and never pretend an action succeeded.",
  "When information should be shown as an interactive UI, first gather or derive the data with the appropriate tool, then call ggui_render_surface to attach a renderer-neutral surface to the answer.",
  "Data can come from files, parsers, algorithms, shell commands, workflows, MCP tools, external searches, or prior tool results; search is only one possible source."
].join(" ");

export function buildInitialMessages({ message }) {
  return [
    { role: "system", content: OBA_SYSTEM_PROMPT },
    { role: "user", content: message }
  ];
}

export function contextMetadata({ toolMode }) {
  return {
    promptVersion: OBA_PROMPT_VERSION,
    toolSchemaVersion: OBA_TOOL_SCHEMA_VERSION,
    contextBlocks: ["stable_prefix", "tool_contracts", "user_message"],
    toolMode
  };
}
