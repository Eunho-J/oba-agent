#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createLmStudioClient, createRequestFromFixture } from "../services/agent-gateway/src/clients/exaone.js";

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("usage: node scripts/lmstudio-smoke.mjs <fixture.json>");
  process.exit(1);
}

try {
  const absoluteFixturePath = path.resolve(process.cwd(), fixturePath);
  const fixture = JSON.parse(await readFile(absoluteFixturePath, "utf8"));
  const request = createRequestFromFixture(fixture);
  const client = createLmStudioClient();
  const response = await client.complete(request);
  const content = String(response?.choices?.[0]?.message?.content || "").trim();
  const mode = String(fixture.mode || "llm.prompt");
  const model = String(request.model || client.model);
  if (mode === "llm.classify") {
    console.log(`lmstudio-ok model=${model} mode=${mode} label=${content}`);
  } else {
    console.log(`lmstudio-ok model=${model} mode=${mode} content=${compact(content)}`);
  }
} catch (error) {
  const code = error?.code || "UNKNOWN";
  console.error(`lmstudio-fail code=${code} message=${error?.message || "unknown error"}`);
  process.exit(1);
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
