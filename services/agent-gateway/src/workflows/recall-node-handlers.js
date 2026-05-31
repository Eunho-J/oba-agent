import { ObsidianVault } from "../vault/adapter.js";
import { asString } from "./runtime-utils.js";

export async function executeRecallNode(node, { inputs, runtimeInput }) {
  const config = node.config ?? {};
  switch (node.type) {
    case "recall.seedCore": {
      const vault = new ObsidianVault({ root: asString(runtimeInput.vaultRoot ?? process.env.OBA_OBSIDIAN_VAULT ?? ".oppa/vault") });
      const notes = await vault.index({ tag: "core" });
      return emit(node, { memories: applyBudget(notes.filter((note) => note.importance === "core"), config.budget) });
    }
    case "recall.select":
      return emit(node, { memories: selectMemories(inputs.memories ?? inputs.notes ?? [], config) });
    case "recall.explain":
      return emit(node, { explanation: explainRecall(inputs.memories ?? [], config.policyRef) });
    default:
      return {};
  }
}

function selectMemories(memories, config) {
  const query = asString(config.query ?? "").toLowerCase();
  let selected = Array.isArray(memories) ? memories : [];
  if (query) {
    selected = selected.filter((note) => [note.title, note.summary, note.body].some((value) => asString(value).toLowerCase().includes(query)));
  }
  return applyBudget(selected.slice(0, config.limit ?? selected.length), config.budget);
}

function applyBudget(notes, budget = 1800) {
  let used = 0;
  const result = [];
  for (const note of notes) {
    const size = asString(note.body ?? note.summary).length;
    if (used + size > budget) continue;
    used += size;
    result.push(note);
  }
  return result;
}

function explainRecall(memories, policyRef) {
  return {
    policyRef: policyRef ?? null,
    count: Array.isArray(memories) ? memories.length : 0,
    ids: (Array.isArray(memories) ? memories : []).map((memory) => memory.id)
  };
}

function emit(node, values) {
  const declared = Object.keys(node.outputs ?? {});
  if (declared.length === 0) return values;
  return Object.fromEntries(Object.entries(values).filter(([key]) => declared.includes(key)));
}
