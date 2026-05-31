import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { executeNode } from "../src/workflows/node-handlers.js";
import { runWorkflow } from "../src/workflows/runner.js";
import { validateWorkflowYaml } from "../src/workflows/validate.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const fixtureDir = path.join(repoRoot, "fixtures", "workflows");

async function readFixture(name) {
  return fs.readFile(path.join(fixtureDir, name), "utf8");
}

test("deterministic fixture returns stable workflow output", async () => {
  const workflow = validateWorkflowYaml(await readFixture("deterministic-basic.yml"), {
    filePath: "deterministic-basic.yml"
  });
  const result = await runWorkflow({
    workflow,
    input: { query: "  Hello   Workflow  " }
  });
  assert.deepEqual(result.outputs, {
    response: "hello workflow::[\"hello\",\"workflow\"]"
  });
});

test("ui intent output remains renderer neutral", async () => {
  const workflow = validateWorkflowYaml(await readFixture("ui-intent.yml"), {
    filePath: "ui-intent.yml"
  });
  const result = await runWorkflow({
    workflow,
    input: { request: { panel: "agenda", mode: "focus" } }
  });
  assert.deepEqual(result.outputs.uiIntent, {
    type: "open.panel",
    payload: { panel: "agenda", mode: "focus" }
  });
});

test("loop.forEach rejects excessive maxIterations cap", async () => {
  const workflow = validateWorkflowYaml(await readFixture("loop-too-large.yml"), {
    filePath: "loop-too-large.yml"
  });
  await assert.rejects(() => runWorkflow({ workflow, input: {} }), (error) => {
    return error.code === "WORKFLOW_VALIDATION_FAILED" && error.message.includes("maxIterations");
  });
});

test("loop.forEach rejects missing maxIterations even without validator gate", async () => {
  const node = {
    id: "loop",
    type: "loop.forEach",
    config: {
      timeoutMs: 10,
      maxConcurrency: 1,
      onError: "fail"
    },
    outputs: { items: { type: "array" } }
  };
  await assert.rejects(
    () => executeNode(node, { inputs: { items: ["a"] }, runtimeInput: {} }),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED" && error.message.includes("maxIterations")
  );
});

test("deterministic node handlers cover parse, transform, flow, and loop nodes", async () => {
  const runtimeInput = { user: "Kim" };
  const frontmatter = await executeNode(
    node("parse.frontmatter", {}, { frontmatter: {}, body: {} }),
    { inputs: { text: "---\ntitle: Note\n---\n# One\nBody [[Alpha|A]]" }, runtimeInput }
  );
  const sections = await executeNode(
    node("parse.markdownSections", {}, { sections: {} }),
    { inputs: { text: frontmatter.body }, runtimeInput }
  );
  const wikilinks = await executeNode(
    node("parse.wikilinks", {}, { links: {} }),
    { inputs: { text: frontmatter.body }, runtimeInput }
  );
  const yaml = await executeNode(
    node("parse.yaml", {}, { value: {} }),
    { inputs: { text: "a: 1\nb: two" }, runtimeInput }
  );
  const json = await executeNode(
    node("parse.json", {}, { value: {} }),
    { inputs: { text: "{\"items\":[{\"id\":\"a\",\"score\":1},{\"id\":\"b\",\"score\":3},{\"id\":\"b\",\"score\":2}]}" }, runtimeInput }
  );
  const template = await executeNode(
    node("transform.template", { template: "{{user}}-{{value.items}}" }, { text: {} }),
    { inputs: json, runtimeInput }
  );
  const normalize = await executeNode(
    node("transform.normalizeText", { normalizer: { trim: true, collapseWhitespace: true, lowercase: true } }, { text: {} }),
    { inputs: { text: "  MIXED   Case " }, runtimeInput }
  );
  const projected = await executeNode(
    node("transform.project", { projection: { headline: "title", count: "items.length" } }, { value: {} }),
    { inputs: { value: { title: "T", items: [1, 2, 3] } }, runtimeInput }
  );
  const scored = await executeNode(
    node("transform.score", { weights: { score: 2 }, scorePath: "score" }, { scored: {} }),
    { inputs: { items: json.value.items }, runtimeInput }
  );
  const filtered = await executeNode(
    node("flow.filter", { condition: "score >= 2", limit: 2 }, { filtered: {} }),
    { inputs: { items: scored.scored }, runtimeInput }
  );
  const deduped = await executeNode(
    node("flow.dedupe", { strategy: "id" }, { deduped: {} }),
    { inputs: { items: filtered.filtered }, runtimeInput }
  );
  const ranked = await executeNode(
    node("flow.rank", { scorePath: "score", limit: 1 }, { ranked: {} }),
    { inputs: { items: deduped.deduped }, runtimeInput }
  );
  const merged = await executeNode(
    node("flow.merge", { strategy: "object" }, { merged: {} }),
    { inputs: { left: yaml.value, right: projected.value }, runtimeInput }
  );
  const branch = await executeNode(
    node("flow.branch", { condition: "value == true" }, { matched: {}, unmatched: {} }),
    { inputs: { value: true }, runtimeInput }
  );
  const coalesce = await executeNode(
    node("flow.coalesce", { fallback: "none" }, { value: {} }),
    { inputs: { first: null, second: normalize.text }, runtimeInput }
  );
  const loopEach = await executeNode(
    node("loop.forEach", { maxIterations: 3, timeoutMs: 10, maxConcurrency: 1, onError: "fail", normalizer: { lowercase: true } }, { items: {} }),
    { inputs: { items: ["A", "B"] }, runtimeInput }
  );
  const loopRetry = await executeNode(
    node("loop.retry", { maxIterations: 2, timeoutMs: 10, maxConcurrency: 1, onError: "fail" }, { value: {} }),
    { inputs: { value: "ok" }, runtimeInput }
  );
  const respond = await executeNode(
    node("output.respond", { template: "{{text}}" }, { response: {} }),
    { inputs: { text: "done" }, runtimeInput }
  );
  const intent = await executeNode(
    node("output.uiIntent", { intent: { type: "open.panel" }, payload: { panel: "inbox" } }, { intent: {} }),
    { inputs: {}, runtimeInput }
  );

  assert.equal(sections.sections[0].title, "One");
  assert.equal(wikilinks.links[0].target, "Alpha");
  assert.equal(template.text, "Kim-[{\"id\":\"a\",\"score\":1},{\"id\":\"b\",\"score\":3},{\"id\":\"b\",\"score\":2}]");
  assert.equal(normalize.text, "mixed case");
  assert.deepEqual(projected.value, { headline: "T", count: 3 });
  assert.equal(ranked.ranked[0].id, "b");
  assert.equal(merged.merged.a, 1);
  assert.equal(branch.matched, true);
  assert.equal(coalesce.value, "mixed case");
  assert.deepEqual(loopEach.items, ["a", "b"]);
  assert.equal(loopRetry.value, "ok");
  assert.equal(respond.response, "done");
  assert.equal(intent.intent.type, "open.panel");
});

test("workflow runner imports remain ggui-free", async () => {
  const files = [
    path.join(repoRoot, "services/agent-gateway/src/workflows/runner.js"),
    path.join(repoRoot, "services/agent-gateway/src/workflows/node-handlers.js"),
    path.join(repoRoot, "services/agent-gateway/src/workflows/runtime-utils.js")
  ];
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    assert.equal(source.includes("ggui"), false);
    assert.equal(source.includes("testapp"), false);
  }
});

function node(type, config, outputs) {
  return {
    id: `${type}-node`,
    type,
    config,
    outputs
  };
}
