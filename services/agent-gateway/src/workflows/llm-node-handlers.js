import { createLmStudioClient } from "../clients/exaone.js";
import { workflowError } from "./errors.js";
import { asString, renderTemplate } from "./runtime-utils.js";

export async function executeLlmNode(node, { inputs, runtimeInput }) {
  const config = node.config ?? {};
  const client = createLmStudioClient(clientConfig(config, runtimeInput));
  switch (node.type) {
    case "llm.prompt":
      return emit(node, { text: await completeText(client, promptRequest(config, inputs, runtimeInput)) });
    case "llm.classify":
      return emit(node, { label: await completeText(client, classifyRequest(config, inputs, runtimeInput)) });
    default:
      throw workflowError(`runtime does not support node type ${node.type}`, { nodeId: node.id, type: node.type });
  }
}

function clientConfig(config, runtimeInput) {
  return {
    baseUrl: runtimeInput.lmStudioBaseUrl ?? config.baseUrl,
    apiKey: runtimeInput.llmApiKey ?? config.apiKey,
    model: config.model ?? runtimeInput.llmModel,
    modelAllowlist: runtimeInput.llmModelAllowlist,
    requestTimeoutMs: runtimeInput.llmRequestTimeoutMs,
    maxTokensCap: runtimeInput.llmMaxTokensCap,
    temperatureCap: runtimeInput.llmTemperatureCap
  };
}

async function completeText(client, request) {
  const response = await client.complete(request);
  return asString(response?.choices?.[0]?.message?.content).trim();
}

function promptRequest(config, inputs, runtimeInput) {
  const context = { ...runtimeInput, ...inputs };
  const messages = [];
  if (config.system) messages.push({ role: "system", content: renderTemplate(config.system, context) });
  messages.push({
    role: "user",
    content: renderTemplate(config.prompt ?? "{{text}}", context)
  });
  return {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    metadata: { mode: "llm.prompt" }
  };
}

function classifyRequest(config, inputs, runtimeInput) {
  const labels = Array.isArray(config.labels) ? config.labels.filter(Boolean).map(String) : [];
  if (labels.length === 0) throw workflowError(`${nodeName(config)} llm.classify requires labels`);
  const text = renderTemplate(config.prompt ?? "{{text}}", { ...runtimeInput, ...inputs });
  return {
    model: config.model,
    messages: [
      {
        role: "system",
        content: `${config.system ?? "Return exactly one label from the provided label set."}\nlabels: ${labels.join(", ")}`
      },
      {
        role: "user",
        content: text
      }
    ],
    temperature: 0,
    max_tokens: config.maxTokens,
    metadata: { mode: "llm.classify", labels }
  };
}

function nodeName(config) {
  return config.description ?? "node";
}

function emit(node, values) {
  const declared = Object.keys(node.outputs ?? {});
  if (declared.length === 0) return values;
  return Object.fromEntries(Object.entries(values).filter(([key]) => declared.includes(key)));
}
