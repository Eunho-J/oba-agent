import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createStreamableHttpMcpAdapter, normalizeMcpServers } from "../src/mcp/adapter.js";
import { ToolRegistry } from "../src/tools/registry.js";

async function startMcpServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url !== "/mcp" || req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }
    const message = await readJson(req);
    if (message.method === "initialize") {
      return sendJson(res, {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: { name: "test-mcp", version: "1.0.0" }
        }
      });
    }
    if (message.method === "notifications/initialized") {
      res.writeHead(202).end();
      return;
    }
    if (message.method === "tools/list") {
      return sendJson(res, {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          tools: [
            {
              name: "echo",
              description: "Echo text",
              inputSchema: {
                type: "object",
                properties: { text: { type: "string" } },
                required: ["text"]
              }
            },
            {
              name: "danger",
              description: "Dangerous write",
              inputSchema: {
                type: "object",
                properties: { text: { type: "string" } },
                required: ["text"]
              }
            }
          ]
        }
      });
    }
    if (message.method === "tools/call") {
      return sendJson(res, {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          content: [{ type: "text", text: message.params.arguments.text }]
        }
      });
    }
    sendJson(res, {
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32601, message: "method not found" }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, body) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

test("normalizes streamable HTTP MCP server config and expands env headers", () => {
  process.env.APIFUSE_TEST_TOKEN = "token-123";
  const servers = normalizeMcpServers({
    apifuse: {
      transport: "streamable-http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer ${APIFUSE_TEST_TOKEN}" },
      enabledTools: ["echo"],
      toolPolicies: { echo: { risk: "read-only" } },
      timeoutMs: 999_999
    }
  });

  assert.equal(servers[0].headers.Authorization, "Bearer token-123");
  assert.equal(servers[0].timeoutMs, 120_000);
  assert.equal(servers[0].toolPolicies.echo.risk, "read-only");
});

test("rejects invalid MCP config", () => {
  assert.throws(
    () => normalizeMcpServers({ bad: { transport: "stdio", url: "http://example.com/mcp" } }),
    /streamable-http/
  );
  assert.throws(
    () => normalizeMcpServers({ bad: { transport: "streamable-http", url: "file:///tmp/mcp" } }),
    /absolute http\(s\) URL/
  );
  assert.throws(
    () => normalizeMcpServers({
      bad: {
        transport: "streamable-http",
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer ${MISSING_MCP_ENV}" }
      }
    }),
    /missing environment variable/
  );
});

test("discovers allowed streamable HTTP MCP tools through the registry", async () => {
  const server = await startMcpServer();
  try {
    const registry = new ToolRegistry();
    const adapter = createStreamableHttpMcpAdapter({
      config: {
        mcpServers: {
          test: {
            transport: "streamable-http",
            url: server.url,
            enabledTools: ["echo", "danger"],
            toolPolicies: {
              echo: { risk: "read-only" },
              danger: { risk: "high-risk-write", expose: false }
            }
          }
        }
      }
    });

    const discovery = await adapter.discover(registry);
    assert.deepEqual(discovery.registeredTools, ["test.echo"]);
    assert.equal(registry.get("test.danger"), undefined);
    const result = await registry.execute("test.echo", { text: "hello mcp" });
    assert.equal(result.content[0].text, "hello mcp");
    await adapter.close();
  } finally {
    await server.close();
  }
});

test("MCP tools without explicit policy are not exposed", async () => {
  const server = await startMcpServer();
  try {
    const registry = new ToolRegistry();
    const adapter = createStreamableHttpMcpAdapter({
      config: {
        mcpServers: {
          test: {
            transport: "streamable-http",
            url: server.url,
            enabledTools: ["echo"]
          }
        }
      }
    });
    const discovery = await adapter.discover(registry);
    assert.deepEqual(discovery.registeredTools, []);
    await adapter.close();
  } finally {
    await server.close();
  }
});

test("MCP discovery failure includes server context and stack", async () => {
  const registry = new ToolRegistry();
  const adapter = createStreamableHttpMcpAdapter({
    config: {
      mcpServers: {
        test: {
          transport: "streamable-http",
          url: "http://127.0.0.1:9/mcp",
          toolPolicies: { echo: { risk: "read-only" } },
          timeoutMs: 100
        }
      }
    }
  });

  await assert.rejects(
    () => adapter.discover(registry),
    (error) => {
      assert.equal(error.code, "MCP_DISCOVERY_FAILED");
      assert.equal(error.details.serverId, "test");
      assert.match(error.stack, /ToolExecutionError/);
      return true;
    }
  );
});
