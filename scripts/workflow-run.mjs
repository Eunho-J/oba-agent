#!/usr/bin/env node
import fs from "node:fs/promises";
import { runWorkflow } from "../services/agent-gateway/src/workflows/runner.js";
import { validateWorkflowYaml } from "../services/agent-gateway/src/workflows/validate.js";

const workflowPath = process.argv[2];
const inputArg = process.argv[3] ?? "{}";
if (!workflowPath) {
  console.error("usage: node scripts/workflow-run.mjs <workflow.yml> '<json-input>'");
  process.exit(2);
}

let input;
try {
  input = JSON.parse(inputArg);
} catch (error) {
  console.error(`invalid JSON input: ${error.message}`);
  process.exit(2);
}

try {
  const source = await fs.readFile(workflowPath, "utf8");
  const workflow = validateWorkflowYaml(source, { filePath: workflowPath });
  const result = await runWorkflow({ workflow, input });
  console.log(
    JSON.stringify(
      {
        workflowId: result.workflowId,
        outputs: result.outputs
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error.code ?? error.name ?? "WORKFLOW_RUN_FAILED");
  console.error(error.message);
  process.exit(1);
}
