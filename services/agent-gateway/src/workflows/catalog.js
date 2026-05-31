export const CATALOG_VERSION = "local-workflow-catalog-v1";

export const MVP_NODE_TYPES = [
  "input",
  "output.respond",
  "output.uiIntent",
  "llm.prompt",
  "llm.classify",
  "vault.search",
  "vault.read",
  "vault.writeCandidate",
  "vault.validateHierarchy",
  "vault.splitCandidate",
  "parse.yaml",
  "parse.json",
  "parse.frontmatter",
  "parse.markdownSections",
  "parse.regex",
  "parse.wikilinks",
  "transform.project",
  "transform.template",
  "transform.normalizeText",
  "transform.score",
  "flow.branch",
  "flow.merge",
  "flow.filter",
  "flow.dedupe",
  "flow.rank",
  "flow.coalesce",
  "loop.forEach",
  "loop.retry",
  "recall.seedCore",
  "recall.select",
  "recall.explain",
  "safety.requireConfirmation",
  "safety.validateSchema",
  "safety.validateInvariants",
  "safety.redactSecrets",
  "apifuse.discover",
  "apifuse.prepareAction",
  "candidate.writeWorkflowPatch",
  "candidate.writeVaultPatch",
  "candidate.writeNodeProposal",
  "candidate.writeSystemPromptProposal",
  "candidate.writeSkillProposal",
  "candidate.writeHookProposal",
  "candidate.writeCodexDelegation",
  "candidate.publish",
  "candidate.rollback"
];

export const REJECTED_NODE_TYPES = [
  "flow.join",
  "flow.fanOut",
  "loop.until",
  "loop.paginate",
  "loop.walkGraph",
  "loop.reduce",
  "workflow.subgraph",
  "workflow.import",
  "apifuse.executeConfirmed",
  "shell.exec",
  "javascript.eval",
  "code.generate"
];

const COMMON_CONFIG_KEYS = ["description", "enabled", "metadata", "notes"];

const CONFIG_KEYS_BY_PREFIX = {
  input: ["name", "default", "schema"],
  output: ["template", "text", "intent", "payload", "schema"],
  llm: ["prompt", "system", "model", "temperature", "maxTokens", "labels", "json"],
  vault: ["query", "tag", "path", "root", "template", "target", "frontmatter", "body", "policyRef", "maxChars", "splitBy"],
  parse: ["source", "pattern", "flags", "schema", "frontmatter", "sections"],
  transform: ["projection", "template", "fields", "weights", "normalizer"],
  flow: ["condition", "strategy", "limit", "scorePath", "sort", "fallback"],
  loop: ["items", "maxIterations", "timeoutMs", "maxConcurrency", "onError"],
  recall: ["budget", "policyRef", "includeCore", "query", "limit"],
  safety: ["schema", "invariants", "message", "redactionPolicy", "confirmationKind"],
  apifuse: ["query", "service", "operation", "parameters", "providerId", "operationId", "body", "connectionId", "confirmationRequired"],
  candidate: ["target", "proposal", "tests", "rationale", "rollback", "root", "candidateId", "snapshotId", "actor", "reason"]
};

export function catalogManifest() {
  return {
    catalogVersion: CATALOG_VERSION,
    mvpNodeTypes: [...MVP_NODE_TYPES],
    rejectedNodeTypes: [...REJECTED_NODE_TYPES]
  };
}

export function nodeCatalogEntry(type) {
  if (!MVP_NODE_TYPES.includes(type)) return null;
  return {
    type,
    configKeys: allowedConfigKeys(type),
    loopBounded: type.startsWith("loop.")
  };
}

export function isRejectedNodeType(type) {
  return REJECTED_NODE_TYPES.includes(type);
}

export function allowedConfigKeys(type) {
  const [prefix] = type.split(".");
  return [...COMMON_CONFIG_KEYS, ...(CONFIG_KEYS_BY_PREFIX[prefix] ?? [])];
}
