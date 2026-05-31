import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApiFuseGuardService } from "../src/actions/apifuse-guard.js";
import { createServer } from "../src/index.js";

async function createTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "oba-apifuse-"));
}

async function postJson(baseUrl, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test("discovery works without requiring a confirmation token", async () => {
  const calls = [];
  const service = createApiFuseGuardService({
    root: await createTempRoot(),
    client: async (request) => {
      calls.push(request);
      return { ok: true };
    }
  });

  const result = await service.discover({
    providerId: "demo",
    operationId: "searchProducts",
    body: { query: "earphones" }
  });

  assert.equal(result.actionExecuted, false);
  assert.equal(result.confirmationRequired, true);
  assert.equal(calls.length, 0);
});

test("prepareAction creates an unconsumed confirmation token in local store", async () => {
  const root = await createTempRoot();
  const service = createApiFuseGuardService({ root });
  const prepared = await service.prepareAction({
    providerId: "demo",
    operationId: "purchase",
    body: { item: "earphones" }
  });

  assert.equal(prepared.confirmationToken.consumed, false);
  const storePath = path.join(root, ".oppa", "apifuse", "confirmation-tokens.json");
  const state = JSON.parse(await fs.readFile(storePath, "utf8"));
  const record = state.tokens[prepared.confirmationToken.id];
  assert.ok(record);
  assert.equal(record.consumed, false);
  assert.equal(record.providerId, "demo");
});

test("executeConfirmed without token fails with ACTION_CONFIRMATION_REQUIRED", async () => {
  const service = createApiFuseGuardService({ root: await createTempRoot() });
  await assert.rejects(
    () => service.executeConfirmed({
      providerId: "demo",
      operationId: "purchase",
      body: { item: "earphones" }
    }),
    (error) => {
      assert.equal(error.code, "ACTION_CONFIRMATION_REQUIRED");
      assert.equal(error.status, 409);
      return true;
    }
  );
});

test("reusing a consumed token fails with ACTION_CONFIRMATION_CONSUMED", async () => {
  const clientCalls = [];
  const service = createApiFuseGuardService({
    root: await createTempRoot(),
    apifuseConfig: { apiKey: "test-key", baseUrl: "https://example.invalid" },
    client: async (request) => {
      clientCalls.push(request);
      return { ok: true, purchaseId: "ord_001" };
    }
  });
  const action = {
    providerId: "demo",
    operationId: "purchase",
    body: { item: "earphones" }
  };
  const prepared = await service.prepareAction(action);
  const tokenId = prepared.confirmationToken.id;

  const firstResult = await service.executeConfirmed({
    ...action,
    confirmationTokenId: tokenId
  });
  assert.equal(firstResult.actionExecuted, true);
  assert.equal(clientCalls.length, 1);

  await assert.rejects(
    () => service.executeConfirmed({
      ...action,
      confirmationTokenId: tokenId
    }),
    (error) => {
      assert.equal(error.code, "ACTION_CONFIRMATION_CONSUMED");
      assert.equal(error.status, 409);
      return true;
    }
  );
});

test("gateway endpoint POST /actions/apifuse/execute returns 409 when token is missing", async () => {
  const provider = {
    name: "scripted",
    async complete() {
      return { id: "resp_1", choices: [{ message: { content: "ok" } }] };
    }
  };

  const server = createServer({
    mcpServers: {},
    apifuse: { baseUrl: "https://api.apifuse.com", apiKey: "" }
  }, {
    provider,
    logger: { event: () => {} }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const response = await postJson(`http://127.0.0.1:${port}`, "/actions/apifuse/execute", {
      providerId: "demo",
      operationId: "purchase",
      body: { item: "earphones" }
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, "ACTION_CONFIRMATION_REQUIRED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
