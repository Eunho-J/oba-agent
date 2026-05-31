import { workflowError } from "./errors.js";

export function deepGet(source, path) {
  if (!path) return source;
  const parts = String(path).split(".");
  let current = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

export function renderTemplate(template, context) {
  if (typeof template !== "string") return "";
  return template.replaceAll(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
    const value = deepGet(context, key.trim());
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  });
}

export function asString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

export function normalizeText(value, normalizer = {}) {
  let next = asString(value);
  if (normalizer.trim) next = next.trim();
  if (normalizer.collapseWhitespace) next = next.replaceAll(/\s+/g, " ");
  if (normalizer.lowercase) next = next.toLowerCase();
  return next;
}

export function projectValue(source, projection, fields) {
  const value = source ?? {};
  if (Array.isArray(fields)) {
    return Object.fromEntries(fields.map((field) => [field, deepGet(value, field)]));
  }
  if (projection && typeof projection === "object") {
    return Object.fromEntries(
      Object.entries(projection).map(([key, path]) => [key, deepGet(value, String(path))])
    );
  }
  return value;
}

export function parseCondition(condition, context) {
  if (typeof condition !== "string" || condition.trim().length === 0) return Boolean(context?.value);
  const match = condition.match(/^([a-zA-Z0-9_.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) return Boolean(deepGet(context, condition.trim()));
  const [, leftPath, op, rawRight] = match;
  const left = deepGet(context, leftPath);
  const right = parseLiteral(rawRight.trim());
  switch (op) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
      return Number(left) > Number(right);
    case "<":
      return Number(left) < Number(right);
    case ">=":
      return Number(left) >= Number(right);
    case "<=":
      return Number(left) <= Number(right);
    default:
      return false;
  }
}

function parseLiteral(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const quoted = raw.match(/^["'](.*)["']$/);
  return quoted ? quoted[1] : raw;
}

export function ensureLoopBounds(node, { maxCap }) {
  const maxIterations = node.config?.maxIterations;
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw workflowError(`${node.id} loop node requires positive integer maxIterations`, {
      nodeId: node.id,
      path: `$/nodes/${node.id}/config/maxIterations`
    });
  }
  if (maxIterations > maxCap) {
    throw workflowError(`${node.id} maxIterations exceeds runtime cap ${maxCap}`, {
      nodeId: node.id,
      maxIterations,
      maxCap
    });
  }
  return maxIterations;
}
