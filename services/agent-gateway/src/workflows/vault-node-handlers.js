import { ObsidianVault, splitCandidate, validateHierarchy } from "../vault/adapter.js";
import { parseMarkdownNote } from "../vault/markdown.js";
import { workflowError } from "./errors.js";
import { asString, renderTemplate } from "./runtime-utils.js";

export async function executeVaultNode(node, { inputs, runtimeInput }) {
  const config = node.config ?? {};
  const vault = new ObsidianVault({ root: vaultRoot(runtimeInput, config) });
  switch (node.type) {
    case "vault.search":
      return emit(node, {
        notes: await vault.index({
          query: asString(inputs.query ?? config.query ?? runtimeInput.query ?? ""),
          tag: asString(inputs.tag ?? config.tag ?? "")
        })
      });
    case "vault.read":
      return emit(node, { note: await vault.read(asString(inputs.path ?? config.path)) });
    case "vault.writeCandidate": {
      const relativePath = asString(inputs.path ?? config.path ?? config.target);
      const markdown = inputs.markdown ?? renderCandidateMarkdown(config, inputs, runtimeInput);
      return emit(node, { candidate: await vault.writeCandidate(relativePath, asString(markdown)) });
    }
    case "vault.validateHierarchy": {
      const notes = normalizeNotes(inputs.notes ?? []);
      validateHierarchy(notes);
      return emit(node, { valid: true });
    }
    case "vault.splitCandidate":
      return emit(node, {
        candidate: splitCandidate(asString(inputs.markdown ?? inputs.note ?? config.body), {
          relativePath: asString(inputs.path ?? config.path ?? "memory/core/core-principles.md")
        })
      });
    default:
      throw workflowError(`runtime does not support node type ${node.type}`, { nodeId: node.id, type: node.type });
  }
}

function vaultRoot(runtimeInput, config) {
  return asString(runtimeInput.vaultRoot ?? config.root ?? process.env.OBA_OBSIDIAN_VAULT ?? ".oppa/vault");
}

function renderCandidateMarkdown(config, inputs, runtimeInput) {
  if (config.template) return renderTemplate(config.template, { ...runtimeInput, ...inputs });
  const frontmatter = config.frontmatter ?? {};
  const body = asString(inputs.body ?? config.body ?? "");
  return `---\n${Object.entries(frontmatter).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n${body}`;
}

function normalizeNotes(value) {
  if (!Array.isArray(value)) throw workflowError("vault.validateHierarchy requires notes array");
  return value.map((note, index) => {
    if (typeof note === "string") return parseMarkdownNote(note, { relativePath: `<inline-${index}>` });
    return note;
  });
}

function emit(node, values) {
  const declared = Object.keys(node.outputs ?? {});
  if (declared.length === 0) return values;
  return Object.fromEntries(Object.entries(values).filter(([key]) => declared.includes(key)));
}
