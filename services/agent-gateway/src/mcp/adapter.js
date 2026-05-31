import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ToolExecutionError } from "../tools/errors.js";

const RISK_LABELS = new Set(["read-only", "idempotent-write", "high-risk-write"]);

export function createStreamableHttpMcpAdapter({ config = {}, logger, clientFactory = createSdkClient } = {}) {
  const servers = normalizeMcpServers(config.mcpServers || {});
  const clients = new Map();
  const toolMap = new Map();

  return {
    async discover(registry) {
      for (const server of servers) {
        let client;
        try {
          client = await clientFactory(server);
        } catch (cause) {
          throw mcpError("MCP server initialization failed", {
            code: "MCP_DISCOVERY_FAILED",
            cause,
            server,
            details: { serverId: server.id, urlHost: new URL(server.url).host }
          });
        }
        clients.set(server.id, client);
        let result;
        try {
          result = await client.listTools(undefined, { timeout: server.timeoutMs });
        } catch (cause) {
          throw mcpError("MCP tool discovery failed", {
            code: "MCP_DISCOVERY_FAILED",
            cause,
            server,
            details: { serverId: server.id, urlHost: new URL(server.url).host }
          });
        }

        for (const tool of result.tools || []) {
          const policy = server.toolPolicies[tool.name] || { risk: "high-risk-write", expose: false };
          if (server.enabledTools && !server.enabledTools.includes(tool.name)) continue;
          if (policy.expose === false || policy.risk === "high-risk-write") continue;

          const registryName = `${server.id}.${tool.name}`;
          const registryTool = {
            name: registryName,
            description: tool.description || `MCP tool ${tool.name} from ${server.id}`,
            parameters: tool.inputSchema || { type: "object", additionalProperties: true },
            risk: policy.risk,
            requiresApproval: policy.risk !== "read-only",
            executorId: `mcp.${server.id}.${tool.name}`,
            version: String(tool._meta?.version || "1.0.0"),
            provenance: server.id,
            async execute(args = {}) {
              try {
                return await client.callTool(
                  { name: tool.name, arguments: args },
                  undefined,
                  { timeout: server.timeoutMs }
                );
              } catch (cause) {
                throw mcpError("MCP tool execution failed", {
                  code: "MCP_TOOL_FAILED",
                  cause,
                  server,
                  details: { serverId: server.id, originalToolName: tool.name, registryToolName: registryName }
                });
              }
            }
          };
          registry.register(registryTool);
          toolMap.set(registryName, { serverId: server.id, originalToolName: tool.name });
          logger?.event?.("mcp.tool.registered", { serverId: server.id, toolName: registryName, risk: policy.risk });
        }
      }
      return { registeredTools: [...toolMap.keys()] };
    },
    async close() {
      await Promise.all([...clients.values()].map((client) => client.close?.()));
    }
  };
}

export function normalizeMcpServers(mcpServers) {
  return Object.entries(mcpServers).map(([id, config]) => normalizeServer(id, config));
}

function normalizeServer(id, config = {}) {
  if (!id) throw new Error("MCP server id is required");
  if (config.transport !== "streamable-http") {
    throw new Error(`MCP server ${id} must use streamable-http transport in v1`);
  }
  const url = validateUrl(config.url, id);
  const timeoutMs = clampTimeout(config.timeoutMs, id);
  const headers = expandHeaders(config.headers || {}, id);
  const toolPolicies = normalizeToolPolicies(config.toolPolicies || {}, id);
  return {
    id,
    transport: config.transport,
    url,
    headers,
    enabledTools: Array.isArray(config.enabledTools) ? config.enabledTools : undefined,
    toolPolicies,
    timeoutMs
  };
}

function validateUrl(value, id) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid protocol");
    return url.toString();
  } catch (cause) {
    throw new Error(`MCP server ${id} url must be an absolute http(s) URL`, { cause });
  }
}

function clampTimeout(value, id) {
  if (value === undefined) return 60_000;
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error(`MCP server ${id} timeoutMs must be positive`);
  }
  return Math.min(timeout, 120_000);
}

function expandHeaders(headers, id) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
    const expanded = String(value).replace(/\$\{([A-Z0-9_]+)\}/g, (_, envName) => {
      if (!process.env[envName]) {
        throw new Error(`MCP server ${id} header ${key} references missing environment variable ${envName}`);
      }
      return process.env[envName];
    });
    return [key, expanded];
  }));
}

function normalizeToolPolicies(toolPolicies, id) {
  return Object.fromEntries(Object.entries(toolPolicies).map(([toolName, policy]) => {
    const risk = policy?.risk || "high-risk-write";
    if (!RISK_LABELS.has(risk)) {
      throw new Error(`MCP server ${id} tool ${toolName} has invalid risk ${risk}`);
    }
    return [toolName, { risk, expose: policy?.expose !== false }];
  }));
}

async function createSdkClient(server) {
  const client = new Client({ name: "oba-agent-gateway", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: { headers: server.headers }
  });
  await client.connect(transport, { timeout: server.timeoutMs });
  return client;
}

function mcpError(message, { code, cause, server, details }) {
  return new ToolExecutionError(message, {
    code,
    cause,
    details: {
      serverId: server.id,
      urlHost: new URL(server.url).host,
      ...details
    }
  });
}
