#!/usr/bin/env node
import fs from "node:fs/promises";
import { validateWorkflowYaml } from "../services/agent-gateway/src/workflows/validate.js";

const workflowPath = process.argv[2];
if (!workflowPath) {
  console.error("usage: node scripts/workflow-validate.mjs <workflow.yml>");
  process.exit(2);
}

try {
  const source = await fs.readFile(workflowPath, "utf8");
  const workflow = validateWorkflowYaml(source, { filePath: workflowPath });
  console.log(`workflow ${workflow.id} valid catalogVersion=${workflow.catalogVersion}`);
} catch (error) {
  console.error(error.code ?? error.name ?? "WORKFLOW_VALIDATION_FAILED");
  console.error(error.message);
  process.exit(1);
}
