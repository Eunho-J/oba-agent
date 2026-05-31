import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBuiltInTools } from "../src/tools/builtins.js";
import { createDefaultToolRegistry, ToolRegistry } from "../src/tools/registry.js";
import { createWorkspace } from "../src/tools/workspace.js";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-tools-"));
  const workspace = createWorkspace({ root });
  const registry = createDefaultToolRegistry({ workspace });
  return { root, workspace, registry };
}

function commonsFetchFixture() {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        query: {
          pages: {
            "1": {
              title: "File:Restaurant.jpg",
              imageinfo: [{
                url: "https://upload.wikimedia.org/wikipedia/commons/example/Restaurant.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Restaurant.jpg",
                extmetadata: {
                  ImageDescription: { value: "<p>Restaurant interior</p>" }
                }
              }]
            }
          }
        }
      };
    }
  });
}

test("default registry exposes built-in file, shell, and ggui tools", async () => {
  const { registry } = await fixture();
  assert.deepEqual(registry.list().map((tool) => tool.name), [
    "read",
    "write",
    "edit",
    "bash",
    "search_images",
    "ggui_render_surface"
  ]);
  assert.deepEqual(registry.specs().map((spec) => spec.function.name), [
    "read",
    "write",
    "edit",
    "bash",
    "search_images",
    "ggui_render_surface"
  ]);
});

test("registry rejects duplicate tool names", () => {
  const registry = new ToolRegistry();
  registry.register({ name: "read", description: "", parameters: {}, execute: async () => ({}) });
  assert.throws(
    () => registry.register({ name: "read", description: "", parameters: {}, execute: async () => ({}) }),
    /Duplicate tool name/
  );
});

test("read reads UTF-8 files under the workspace root", async () => {
  const { root, registry } = await fixture();
  await fs.writeFile(path.join(root, "note.txt"), "안녕 OBA", "utf8");
  const result = await registry.execute("read", { path: "note.txt" });
  assert.equal(result.content, "안녕 OBA");
});

test("read rejects paths outside the workspace root", async () => {
  const { registry } = await fixture();
  await assert.rejects(
    () => registry.execute("read", { path: "../outside.txt" }),
    /escapes workspace root/
  );
});

test("read rejects symlinks escaping the workspace root", async (t) => {
  if (process.platform === "win32") t.skip("symlink behavior is platform-specific on Windows");
  const { root, registry } = await fixture();
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "oba-outside-"));
  await fs.writeFile(path.join(outside, "secret.txt"), "secret", "utf8");
  await fs.symlink(path.join(outside, "secret.txt"), path.join(root, "secret-link.txt"));
  await assert.rejects(
    () => registry.execute("read", { path: "secret-link.txt" }),
    /escapes workspace root/
  );
});

test("write creates UTF-8 files under the workspace root", async () => {
  const { root, registry } = await fixture();
  const result = await registry.execute("write", { path: "out.txt", content: "hello" });
  assert.equal(result.bytes, 5);
  assert.equal(await fs.readFile(path.join(root, "out.txt"), "utf8"), "hello");
});

test("write rejects outside-root paths and symlink parents", async (t) => {
  if (process.platform === "win32") t.skip("symlink behavior is platform-specific on Windows");
  const { root, registry } = await fixture();
  await assert.rejects(
    () => registry.execute("write", { path: "../out.txt", content: "nope" }),
    /escapes workspace root/
  );

  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "oba-outside-"));
  await fs.symlink(outside, path.join(root, "outside-dir"));
  await assert.rejects(
    () => registry.execute("write", { path: "outside-dir/out.txt", content: "nope" }),
    /escapes workspace root/
  );
});

test("write rejects symlink file targets", async (t) => {
  if (process.platform === "win32") t.skip("symlink behavior is platform-specific on Windows");
  const { root, registry } = await fixture();
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "oba-outside-"));
  const outsideFile = path.join(outside, "target.txt");
  await fs.writeFile(outsideFile, "outside", "utf8");
  await fs.symlink(outsideFile, path.join(root, "target-link.txt"));

  await assert.rejects(
    () => registry.execute("write", { path: "target-link.txt", content: "escaped" }),
    (error) => {
      assert.equal(error.code, "WORKSPACE_SYMLINK_TARGET");
      return true;
    }
  );
  assert.equal(await fs.readFile(outsideFile, "utf8"), "outside");
});

test("edit applies focused replacements and rejects missing or ambiguous targets", async () => {
  const { root, registry } = await fixture();
  await fs.writeFile(path.join(root, "edit.txt"), "one two one", "utf8");

  await assert.rejects(
    () => registry.execute("edit", { path: "edit.txt", oldText: "one", newText: "1" }),
    /multiple locations/
  );

  const result = await registry.execute("edit", {
    path: "edit.txt",
    oldText: "one",
    newText: "1",
    replaceAll: true
  });
  assert.equal(result.replacements, 2);
  assert.equal(await fs.readFile(path.join(root, "edit.txt"), "utf8"), "1 two 1");

  await assert.rejects(
    () => registry.execute("edit", { path: "edit.txt", oldText: "missing", newText: "x" }),
    /not found/
  );
});

test("bash executes commands from an allowed cwd and returns non-zero results", async () => {
  const { root, registry } = await fixture();
  await fs.mkdir(path.join(root, "work"));
  const success = await registry.execute("bash", { cwd: "work", command: "printf ok" });
  assert.equal(success.stdout, "ok");
  assert.equal(success.exitCode, 0);

  const failed = await registry.execute("bash", { command: "printf nope >&2; exit 7" });
  assert.equal(failed.stderr, "nope");
  assert.equal(failed.exitCode, 7);
});

test("bash rejects outside-root cwd and symlink cwd", async (t) => {
  if (process.platform === "win32") t.skip("symlink behavior is platform-specific on Windows");
  const { root, registry } = await fixture();
  await assert.rejects(
    () => registry.execute("bash", { cwd: "../outside", command: "pwd" }),
    /escapes workspace root/
  );

  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "oba-outside-"));
  await fs.symlink(outside, path.join(root, "outside-cwd"));
  await assert.rejects(
    () => registry.execute("bash", { cwd: "outside-cwd", command: "pwd" }),
    /escapes workspace root/
  );
});

test("bash timeout produces a stackful timeout error", async () => {
  const { registry } = await fixture();
  await assert.rejects(
    () => registry.execute("bash", { command: "sleep 1", timeoutMs: 10 }),
    (error) => {
      assert.equal(error.code, "TOOL_TIMEOUT");
      assert.match(error.stack, /ToolExecutionError/);
      return true;
    }
  );
});

test("search_images returns structured external image data", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-ggui-tool-"));
  const registry = createDefaultToolRegistry({
    workspace: createWorkspace({ root }),
    fetchImpl: commonsFetchFixture()
  });

  const result = await registry.execute("search_images", {
    query: "restaurant food interior",
    limit: 2
  });

  assert.equal(result.source, "wikimedia-commons");
  assert.equal(result.query, "restaurant food interior");
  assert.equal(result.images[0].caption, "Restaurant interior");
  assert.equal(result.images[0].source, "https://commons.wikimedia.org/wiki/File:Restaurant.jpg");
});

test("ggui_render_surface returns a renderer-neutral surface from prepared data", async () => {
  const { registry } = await fixture();
  const result = await registry.execute("ggui_render_surface", {
    type: "comparison.table",
    payload: {
      columns: ["name", { key: "score", label: "Score" }],
      items: [{ name: "A", score: "9" }]
    }
  });

  assert.equal(result.kind, "ggui.surface");
  assert.equal(result.surface.kind, "comparisonTable");
  assert.equal(result.surface.title, undefined);
  assert.equal(result.surface.columns[1].label, "Score");
});

test("built-in tool metadata keeps tools evolvable", async () => {
  const { workspace } = await fixture();
  for (const tool of createBuiltInTools({ workspace })) {
    assert.equal(typeof tool.executorId, "string");
    assert.equal(typeof tool.version, "string");
    assert.equal(tool.provenance, "builtin");
    assert.ok(["read-only", "idempotent-write", "high-risk-write"].includes(tool.risk));
  }
});
