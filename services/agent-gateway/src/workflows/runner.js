import { workflowError } from "./errors.js";
import { executeNode } from "./node-handlers.js";

export async function runWorkflow({ workflow, input = {} }) {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const incoming = new Map(workflow.nodes.map((node) => [node.id, []]));
  const outgoing = new Map(workflow.nodes.map((node) => [node.id, []]));
  const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));

  for (const edge of workflow.edges) {
    incoming.get(edge.to.node).push(edge);
    outgoing.get(edge.from.node).push(edge.to.node);
    indegree.set(edge.to.node, (indegree.get(edge.to.node) ?? 0) + 1);
  }

  const queue = workflow.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const ordered = [];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    ordered.push(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (ordered.length !== workflow.nodes.length) {
    throw workflowError("workflow runner requires DAG execution order", { workflowId: workflow.id });
  }

  const nodeOutputs = {};
  for (const nodeId of ordered) {
    const node = nodesById.get(nodeId);
    const inputs = resolveNodeInputs(node, incoming.get(nodeId) ?? [], nodeOutputs);
    nodeOutputs[nodeId] = await executeNode(node, { inputs, runtimeInput: input });
  }

  const outputs = {};
  for (const [key, binding] of Object.entries(workflow.outputs ?? {})) {
    outputs[key] = nodeOutputs[binding.node]?.[binding.outputPort];
  }

  return { workflowId: workflow.id, outputs, nodeOutputs };
}

function resolveNodeInputs(node, edges, nodeOutputs) {
  const resolved = {};
  for (const edge of edges) {
    const value = nodeOutputs[edge.from.node]?.[edge.from.outputPort];
    if (resolved[edge.to.inputPort] === undefined) {
      resolved[edge.to.inputPort] = value;
      continue;
    }
    if (!Array.isArray(resolved[edge.to.inputPort])) {
      resolved[edge.to.inputPort] = [resolved[edge.to.inputPort]];
    }
    resolved[edge.to.inputPort].push(value);
  }
  for (const [port, spec] of Object.entries(node.inputs ?? {})) {
    if (resolved[port] === undefined && spec?.default !== undefined) resolved[port] = spec.default;
  }
  return resolved;
}
