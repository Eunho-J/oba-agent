import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runWorkflow } from "../src/workflows/runner.js";
import { validateWorkflowYaml } from "../src/workflows/validate.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

test("apifuse workflow nodes discover and prepare without executing action", async () => {
  const workflow = validateWorkflowYaml(await workflowFixture("apifuse-discover-prepare.yml"), {
    filePath: "apifuse-discover-prepare.yml"
  });
  const apifuseRoot = await fs.mkdtemp(path.join(os.tmpdir(), "oba-apifuse-node-"));
  const result = await runWorkflow({
    workflow,
    input: {
      apifuseRoot,
      action: {
        providerId: "demo",
        operationId: "purchase",
        body: { item: "earphones", quantity: 1 }
      }
    }
  });

  assert.equal(result.outputs.response, "false::true::false");
  assert.equal(result.outputs.prepared.actionExecuted, false);
  assert.equal(result.outputs.prepared.confirmationToken.consumed, false);
  const tokenStore = JSON.parse(await fs.readFile(path.join(apifuseRoot, ".oppa/apifuse/confirmation-tokens.json"), "utf8"));
  assert.ok(tokenStore.tokens[result.outputs.prepared.confirmationToken.id]);
});

test("apifuse prepare node rejects malformed actions", async () => {
  const workflow = validateWorkflowYaml(await workflowFixture("apifuse-invalid-action.yml"), {
    filePath: "apifuse-invalid-action.yml"
  });
  const apifuseRoot = await awaitTempRoot();
  await assert.rejects(
    () => runWorkflow({ workflow, input: { apifuseRoot } }),
    (error) => error.code === "VALIDATION_ERROR" && error.message.includes("providerId")
  );
});

async function workflowFixture(name) {
  return fs.readFile(path.join(repoRoot, "fixtures", "workflows", name), "utf8");
}

async function awaitTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "oba-apifuse-node-"));
}
