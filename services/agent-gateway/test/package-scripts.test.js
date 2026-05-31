import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

async function readPackageJson(relativePath) {
  const packagePath = path.join(repoRoot, relativePath);
  return JSON.parse(await readFile(packagePath, "utf8"));
}

function includesWholeTestDirectory(script, directory) {
  return script.split(/\s+/).includes(directory);
}

function includesJavaScriptAndModuleTests(script) {
  return script.includes(".test.js") && script.includes(".test.mjs");
}

test("root package scripts cover gateway tests and explicit entrypoints", async () => {
  // Given: the root package script contract is the default developer entrypoint.
  const packageJson = await readPackageJson("package.json");
  const scripts = packageJson.scripts;

  // When: consumers run the documented root scripts.
  const testScript = scripts.test ?? "";
  const providerScript = scripts["test:provider"] ?? "";
  const androidBuildScript = scripts["build:android"] ?? "";

  // Then: default tests include both JS and MJS gateway tests.
  assert.equal(
    includesWholeTestDirectory(testScript, "services/agent-gateway/test") ||
      includesJavaScriptAndModuleTests(testScript),
    true
  );

  // Then: provider tests are exposed without forcing the provider opt-in env var.
  assert.match(providerScript, /services\/agent-gateway\/test\/provider\.integration\.test\.js/);
  assert.equal(providerScript.includes("OBA_RUN_CODEX_AS_API_TESTS=1"), false);

  // Then: Android debug builds have an explicit root shortcut.
  assert.match(androidBuildScript, /apps\/android/);
  assert.match(androidBuildScript, /assembleDebug/);
});

test("gateway package test script covers JavaScript and module tests", async () => {
  // Given: the service package can be tested directly by workspace tooling.
  const packageJson = await readPackageJson("services/agent-gateway/package.json");

  // When: its test script is inspected.
  const testScript = packageJson.scripts?.test ?? "";

  // Then: it includes the full test directory or both test module extensions.
  assert.equal(
    includesWholeTestDirectory(testScript, "test") || includesJavaScriptAndModuleTests(testScript),
    true
  );
});
