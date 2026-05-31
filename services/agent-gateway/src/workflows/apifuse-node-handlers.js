import { createApiFuseGuardService } from "../actions/apifuse-guard.js";
import { workflowError } from "./errors.js";

export async function executeApiFuseNode(node, { inputs, runtimeInput }) {
  const service = createApiFuseGuardService({
    root: runtimeInput.apifuseRoot ?? process.cwd(),
    apifuseConfig: runtimeInput.apifuseConfig ?? {}
  });
  const action = actionPayload(node.config ?? {}, inputs);
  switch (node.type) {
    case "apifuse.discover":
      return emit(node, { discovery: await service.discover(action) });
    case "apifuse.prepareAction":
      return emit(node, { prepared: await service.prepareAction(action) });
    default:
      throw workflowError(`runtime does not support node type ${node.type}`, { nodeId: node.id, type: node.type });
  }
}

function actionPayload(config, inputs) {
  const action = inputs.action ?? {};
  return {
    providerId: inputs.providerId ?? action.providerId ?? config.providerId ?? config.service,
    operationId: inputs.operationId ?? action.operationId ?? config.operationId ?? config.operation,
    connectionId: inputs.connectionId ?? action.connectionId ?? config.connectionId,
    body: inputs.body ?? action.body ?? config.body ?? config.parameters ?? {}
  };
}

function emit(node, values) {
  const declared = Object.keys(node.outputs ?? {});
  if (declared.length === 0) return values;
  return Object.fromEntries(Object.entries(values).filter(([key]) => declared.includes(key)));
}
