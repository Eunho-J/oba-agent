#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApiFuseGuardService } from "../services/agent-gateway/src/actions/apifuse-guard.js";

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("usage: node scripts/apifuse-smoke.mjs <fixture.json>");
  process.exit(2);
}

try {
  const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-apifuse-smoke-"));
  const clientCalls = [];
  const service = createApiFuseGuardService({
    root,
    apifuseConfig: { baseUrl: "https://api.apifuse.com", apiKey: "smoke-key" },
    client: async (request) => {
      clientCalls.push({
        providerId: request.providerId,
        operationId: request.operationId,
        body: request.body
      });
      return {
        ok: true,
        echoedOperation: request.operationId,
        echoedBody: request.body
      };
    }
  });

  const action = {
    providerId: fixture.providerId,
    operationId: fixture.operationId,
    body: fixture.body || {}
  };

  const discovery = await service.discover(action);
  const prepared = await service.prepareAction(action);

  let executeWithoutToken;
  try {
    await service.executeConfirmed(action);
    executeWithoutToken = { ok: true };
  } catch (error) {
    executeWithoutToken = { ok: false, code: error.code, message: error.message };
  }

  const executed = await service.executeConfirmed({
    ...action,
    confirmationTokenId: prepared.confirmationToken.id
  });

  let reusedTokenResult;
  try {
    await service.executeConfirmed({
      ...action,
      confirmationTokenId: prepared.confirmationToken.id
    });
    reusedTokenResult = { ok: true };
  } catch (error) {
    reusedTokenResult = { ok: false, code: error.code, message: error.message };
  }

  const summary = {
    fixture: path.basename(fixturePath),
    discovery: {
      actionExecuted: discovery.actionExecuted,
      confirmationRequired: discovery.confirmationRequired
    },
    prepared: {
      confirmationTokenId: prepared.confirmationToken.id,
      consumed: prepared.confirmationToken.consumed
    },
    executeWithoutToken,
    executeConfirmed: {
      actionExecuted: executed.actionExecuted,
      confirmationToken: executed.confirmationToken,
      result: executed.result
    },
    executeReusedToken: reusedTokenResult,
    clientCalls
  };

  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error.code || error.name || "ERROR");
  console.error(error.message);
  process.exit(1);
}
