import { parse as parseYaml } from "yaml";
import { workflowError } from "./errors.js";
import { executeApiFuseNode } from "./apifuse-node-handlers.js";
import { executeCandidateNode } from "./candidate-node-handlers.js";
import { executeLlmNode } from "./llm-node-handlers.js";
import { executeRecallNode } from "./recall-node-handlers.js";
import { executeSafetyNode } from "./safety-node-handlers.js";
import { executeVaultNode } from "./vault-node-handlers.js";
import { asString, deepGet, ensureLoopBounds, normalizeText, parseCondition, projectValue, renderTemplate } from "./runtime-utils.js";

const RUNNER_MAX_ITERATIONS = 1000;

export async function executeNode(node, { inputs, runtimeInput }) {
  const config = node.config ?? {};
  if (node.type.startsWith("apifuse.")) return executeApiFuseNode(node, { inputs, runtimeInput });
  if (node.type.startsWith("llm.")) return executeLlmNode(node, { inputs, runtimeInput });
  if (node.type.startsWith("vault.")) return executeVaultNode(node, { inputs, runtimeInput });
  if (node.type.startsWith("recall.")) return executeRecallNode(node, { inputs, runtimeInput });
  if (node.type.startsWith("safety.")) return executeSafetyNode(node, { inputs, runtimeInput });
  if (node.type.startsWith("candidate.")) return executeCandidateNode(node, { inputs, runtimeInput });
  switch (node.type) {
    case "input":
      return emit(node, { value: runtimeInput[config.name] ?? config.default ?? null });
    case "output.respond":
      return emit(node, {
        response: config.template ? renderTemplate(config.template, inputContext(inputs, runtimeInput)) : asString(inputs.body ?? config.text ?? "")
      });
    case "output.uiIntent": {
      const intentConfig = config.intent ?? {};
      const type = typeof intentConfig === "string" ? intentConfig : intentConfig.type;
      const payload = inputs.payload ?? inputs.value ?? config.payload ?? intentConfig.payload ?? null;
      return emit(node, { intent: { type: type ?? "ui.intent", payload } });
    }
    case "parse.json":
      return emit(node, { value: parseJson(inputs.text ?? inputs.value ?? config.source ?? "") });
    case "parse.yaml":
      return emit(node, { value: parseYaml(asString(inputs.text ?? inputs.value ?? config.source ?? "")) ?? null });
    case "parse.regex":
      return emit(node, { matches: parseRegex(inputs.text ?? inputs.value ?? config.source ?? "", config) });
    case "parse.wikilinks":
      return emit(node, { links: parseWikilinks(inputs.text ?? inputs.value ?? config.source ?? "") });
    case "parse.frontmatter":
      return emit(node, parseFrontmatter(inputs.text ?? inputs.value ?? config.source ?? ""));
    case "parse.markdownSections":
      return emit(node, { sections: parseMarkdownSections(inputs.text ?? inputs.value ?? config.source ?? "") });
    case "transform.project":
      return emit(node, { value: projectValue(inputs.value ?? inputs.object ?? inputs.body, config.projection, config.fields) });
    case "transform.template":
      return emit(node, { text: renderTemplate(config.template ?? "", inputContext(inputs, runtimeInput)) });
    case "transform.normalizeText":
      return emit(node, { text: normalizeText(inputs.text ?? inputs.value ?? "", config.normalizer ?? {}) });
    case "transform.score":
      return emit(node, { scored: scoreItems(inputs.items ?? inputs.value ?? [], config.weights, config.scorePath) });
    case "flow.branch": {
      const matched = parseCondition(config.condition, inputContext(inputs, runtimeInput));
      return emit(node, { matched: matched ? inputs.value ?? inputs.items ?? true : null, unmatched: matched ? null : inputs.value ?? inputs.items ?? false });
    }
    case "flow.merge":
      return emit(node, { merged: mergeInputs(inputs, config.strategy) });
    case "flow.filter":
      return emit(node, { filtered: filterItems(inputs.items ?? inputs.value ?? [], config) });
    case "flow.dedupe":
      return emit(node, { deduped: dedupeItems(inputs.items ?? inputs.value ?? [], config.scorePath ?? config.strategy) });
    case "flow.rank":
      return emit(node, { ranked: rankItems(inputs.items ?? inputs.value ?? [], config.scorePath, config.limit) });
    case "flow.coalesce":
      return emit(node, { value: coalesceValues(inputs, config.fallback) });
    case "loop.forEach":
      return emit(node, { items: runForEach(node, inputs, runtimeInput) });
    case "loop.retry":
      return emit(node, { value: runRetry(node, inputs) });
    default:
      throw workflowError(`runtime does not support node type ${node.type}`, { nodeId: node.id, type: node.type });
  }
}

function inputContext(inputs, runtimeInput) {
  return { ...runtimeInput, ...inputs, input: runtimeInput };
}

function emit(node, values) {
  const declared = Object.keys(node.outputs ?? {});
  if (declared.length === 0) return values;
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    if (declared.includes(key)) result[key] = value;
  }
  if (Object.keys(result).length > 0) return result;
  if (declared.length === 1) return { [declared[0]]: Object.values(values)[0] };
  return values;
}

function parseJson(source) {
  if (source && typeof source === "object") return source;
  try {
    return JSON.parse(asString(source));
  } catch (error) {
    throw workflowError(`parse.json failed: ${error.message}`);
  }
}

function parseRegex(source, config) {
  const regex = new RegExp(config.pattern ?? ".*", config.flags ?? "");
  const text = asString(source);
  return [...text.matchAll(regex)].map((match) => match[1] ?? match[0]);
}

function parseWikilinks(source) {
  const links = [];
  for (const match of asString(source).matchAll(/\[\[([^\]]+)\]\]/g)) {
    const [target, alias] = match[1].split("|");
    links.push({ target: target.trim(), alias: alias?.trim() ?? null });
  }
  return links;
}

function parseFrontmatter(source) {
  const text = asString(source);
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };
  return { frontmatter: parseYaml(match[1]) ?? {}, body: match[2] ?? "" };
}

function parseMarkdownSections(source) {
  const lines = asString(source).split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { level: heading[1].length, title: heading[2].trim(), body: "" };
      continue;
    }
    if (current) current.body += `${current.body ? "\n" : ""}${line}`;
  }
  if (current) sections.push(current);
  return sections;
}

function scoreItems(items, weights = {}, scorePath) {
  const list = Array.isArray(items) ? items : [];
  return list.map((item) => {
    let score = 0;
    if (scorePath) score += Number(deepGet(item, scorePath) ?? 0);
    for (const [path, weight] of Object.entries(weights ?? {})) score += Number(deepGet(item, path) ?? 0) * Number(weight);
    if (item && typeof item === "object" && !Array.isArray(item)) return { ...item, score };
    return { value: item, score };
  });
}

function mergeInputs(inputs, strategy) {
  const values = Object.values(inputs);
  if (strategy === "object") {
    return values.reduce((acc, value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(acc, value);
      return acc;
    }, {});
  }
  return values.flatMap((value) => (Array.isArray(value) ? value : [value]));
}

function filterItems(items, config) {
  let list = Array.isArray(items) ? items : [];
  if (typeof config.condition === "string" && config.condition.length > 0) {
    list = list.filter((item) => parseCondition(config.condition, { item, ...item }));
  }
  if (Number.isInteger(config.limit) && config.limit >= 0) list = list.slice(0, config.limit);
  return list;
}

function dedupeItems(items, keyPath = "id") {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const key = typeof item === "object" ? deepGet(item, keyPath) : item;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function rankItems(items, scorePath = "score", limit) {
  const list = [...(Array.isArray(items) ? items : [])];
  list.sort((a, b) => Number(deepGet(b, scorePath) ?? 0) - Number(deepGet(a, scorePath) ?? 0));
  if (Number.isInteger(limit) && limit >= 0) return list.slice(0, limit);
  return list;
}

function coalesceValues(inputs, fallback) {
  for (const value of Object.values(inputs)) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback ?? null;
}

function runForEach(node, inputs, runtimeInput) {
  const maxIterations = ensureLoopBounds(node, { maxCap: RUNNER_MAX_ITERATIONS });
  const items = inputs.items ?? [];
  if (!Array.isArray(items)) throw workflowError(`${node.id} loop.forEach requires array items`, { nodeId: node.id });
  if (items.length > maxIterations) {
    throw workflowError(`${node.id} received ${items.length} items beyond maxIterations ${maxIterations}`, {
      nodeId: node.id,
      size: items.length,
      maxIterations
    });
  }
  return items.map((item, index) => {
    if (node.config?.template) return renderTemplate(node.config.template, { ...runtimeInput, ...inputs, item, index });
    if (node.config?.projection || node.config?.fields) return projectValue(item, node.config.projection, node.config.fields);
    if (node.config?.normalizer) return normalizeText(item, node.config.normalizer);
    return item;
  });
}

function runRetry(node, inputs) {
  ensureLoopBounds(node, { maxCap: RUNNER_MAX_ITERATIONS });
  const candidates = [inputs.value, inputs.result, inputs.body].filter((value) => value !== undefined);
  return candidates[0] ?? null;
}
