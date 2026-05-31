import { CATALOG_VERSION, allowedConfigKeys, isRejectedNodeType, nodeCatalogEntry } from "./catalog.js";
import { nodeNotInMvpError, workflowError } from "./errors.js";
import { assertArray, assertOptionalObject, assertPlainObject, assertString, parseWorkflowYaml } from "./schema.js";

const REQUIRED_WORKFLOW_KEYS = ["id", "version", "nodes", "edges", "outputs", "catalogVersion"];
const ALLOWED_WORKFLOW_KEYS = new Set([
  "id",
  "version",
  "description",
  "inputs",
  "nodes",
  "edges",
  "outputs",
  "invariants",
  "smokeTests",
  "catalogVersion"
]);
const ALLOWED_NODE_KEYS = new Set(["id", "type", "label", "config", "inputs", "outputs", "risk", "uiIntent"]);
const ALLOWED_EDGE_KEYS = new Set(["from", "to"]);

export function validateWorkflowYaml(source, options) {
  return validateWorkflow(parseWorkflowYaml(source, options));
}

export function validateWorkflow(workflow) {
  assertPlainObject(workflow, "$");
  rejectUnknownKeys(workflow, ALLOWED_WORKFLOW_KEYS, "$");
  for (const key of REQUIRED_WORKFLOW_KEYS) {
    if (workflow[key] === undefined) throw workflowError(`$/${key} is required`, { path: `$/${key}` });
  }
  assertString(workflow.id, "$/id");
  assertString(workflow.version, "$/version");
  assertString(workflow.catalogVersion, "$/catalogVersion");
  if (workflow.catalogVersion !== CATALOG_VERSION) {
    throw workflowError(`catalogVersion must be ${CATALOG_VERSION}`, { path: "$/catalogVersion" });
  }
  assertOptionalObject(workflow.inputs, "$/inputs");
  assertArray(workflow.nodes, "$/nodes");
  assertArray(workflow.edges, "$/edges");
  assertOptionalObject(workflow.outputs, "$/outputs");
  if (workflow.invariants !== undefined) assertArray(workflow.invariants, "$/invariants");
  if (workflow.smokeTests !== undefined) assertArray(workflow.smokeTests, "$/smokeTests");

  const nodeMap = new Map();
  for (const [index, node] of workflow.nodes.entries()) {
    validateNode(node, `$/nodes/${index}`);
    if (nodeMap.has(node.id)) throw workflowError(`duplicate node id ${node.id}`, { path: `$/nodes/${index}/id` });
    nodeMap.set(node.id, node);
  }
  validateEdges(workflow.edges, nodeMap);
  validateRequiredInputs(nodeMap, workflow.edges);
  validateCycles(nodeMap, workflow.edges);
  return {
    ...workflow,
    catalogVersion: CATALOG_VERSION
  };
}

function validateNode(node, path) {
  assertPlainObject(node, path);
  rejectUnknownKeys(node, ALLOWED_NODE_KEYS, path);
  assertString(node.id, `${path}/id`);
  assertString(node.type, `${path}/type`);
  if (isRejectedNodeType(node.type)) throw nodeNotInMvpError(node.type, { path: `${path}/type` });
  const catalogEntry = nodeCatalogEntry(node.type);
  if (!catalogEntry) throw workflowError(`unknown node type ${node.type}`, { path: `${path}/type` });
  assertOptionalObject(node.config, `${path}/config`);
  assertOptionalObject(node.inputs, `${path}/inputs`);
  assertOptionalObject(node.outputs, `${path}/outputs`);
  rejectUnknownKeys(node.config ?? {}, new Set(allowedConfigKeys(node.type)), `${path}/config`);
  if (node.type.startsWith("loop.")) validateLoopBounds(node, path);
}

function validateLoopBounds(node, path) {
  const config = node.config ?? {};
  for (const key of ["maxIterations", "timeoutMs", "maxConcurrency", "onError"]) {
    if (config[key] === undefined) throw workflowError(`${path}/config/${key} is required for loop nodes`, { path: `${path}/config/${key}` });
  }
  if (!Number.isInteger(config.maxIterations) || config.maxIterations < 1) {
    throw workflowError(`${path}/config/maxIterations must be a positive integer`, { path: `${path}/config/maxIterations` });
  }
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1) {
    throw workflowError(`${path}/config/timeoutMs must be a positive integer`, { path: `${path}/config/timeoutMs` });
  }
  if (!Number.isInteger(config.maxConcurrency) || config.maxConcurrency < 1) {
    throw workflowError(`${path}/config/maxConcurrency must be a positive integer`, { path: `${path}/config/maxConcurrency` });
  }
}

function validateEdges(edges, nodeMap) {
  for (const [index, edge] of edges.entries()) {
    const path = `$/edges/${index}`;
    assertPlainObject(edge, path);
    rejectUnknownKeys(edge, ALLOWED_EDGE_KEYS, path);
    assertEndpoint(edge.from, `${path}/from`);
    assertEndpoint(edge.to, `${path}/to`);
    const fromNode = nodeMap.get(edge.from.node);
    const toNode = nodeMap.get(edge.to.node);
    if (!fromNode) throw workflowError(`${path}/from/node references unknown node`, { path: `${path}/from/node` });
    if (!toNode) throw workflowError(`${path}/to/node references unknown node`, { path: `${path}/to/node` });
    if (!portNames(fromNode.outputs).includes(edge.from.outputPort)) {
      throw workflowError(`${path}/from/outputPort is undeclared`, { path: `${path}/from/outputPort`, nodeId: fromNode.id });
    }
    if (!portNames(toNode.inputs).includes(edge.to.inputPort)) {
      throw workflowError(`${path}/to/inputPort is undeclared`, { path: `${path}/to/inputPort`, nodeId: toNode.id });
    }
  }
}

function validateRequiredInputs(nodeMap, edges) {
  const connected = new Set(edges.map((edge) => `${edge.to.node}:${edge.to.inputPort}`));
  for (const node of nodeMap.values()) {
    if (node.type === "input") continue;
    for (const [port, spec] of Object.entries(node.inputs ?? {})) {
      if (spec?.required === true && !connected.has(`${node.id}:${port}`)) {
        throw workflowError(`required input ${node.id}.${port} is not connected`, { nodeId: node.id, inputPort: port });
      }
    }
  }
}

function validateCycles(nodeMap, edges) {
  const adjacency = new Map([...nodeMap.keys()].map((nodeId) => [nodeId, []]));
  for (const edge of edges) adjacency.get(edge.from.node).push(edge.to.node);
  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId, stack) {
    if (visiting.has(nodeId)) {
      const cycle = stack.slice(stack.indexOf(nodeId));
      validateCycleIsBounded(cycle, nodeMap);
      return;
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) visit(next, [...stack, next]);
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const nodeId of nodeMap.keys()) visit(nodeId, [nodeId]);
}

function validateCycleIsBounded(cycle, nodeMap) {
  const loopNodes = cycle.map((nodeId) => nodeMap.get(nodeId)).filter((node) => node?.type.startsWith("loop."));
  if (loopNodes.length === 0) throw workflowError("cycle outside bounded loop nodes is not allowed", { cycle });
  for (const node of loopNodes) validateLoopBounds(node, `$/nodes/${node.id}`);
}

function assertEndpoint(value, path) {
  assertPlainObject(value, path);
  assertString(value.node, `${path}/node`);
  assertString(value.inputPort ?? value.outputPort, `${path}/port`);
}

function portNames(ports = {}) {
  return Object.keys(ports);
}

function rejectUnknownKeys(value, allowedKeys, path) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw workflowError(`${path}/${key} is not allowed`, { path: `${path}/${key}` });
  }
}
