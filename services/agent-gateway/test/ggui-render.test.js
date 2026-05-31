import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "../src/index.js";
import { renderGguiSurface } from "../src/ggui/render.js";
import { validateWorkflowYaml } from "../src/workflows/validate.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

test("renderGguiSurface shapes image gallery payload into renderer-neutral surface", async () => {
  const fixture = await fs.readFile(
    path.join(repoRoot, "fixtures", "ggui", "restaurant-photo-explorer.json"),
    "utf8"
  );
  const restaurantPayload = JSON.parse(fixture);
  const surface = renderGguiSurface({
    type: "image.gallery",
    payload: {
      title: restaurantPayload.restaurantName,
      sourceUrl: restaurantPayload.sourceUrl,
      images: restaurantPayload.photos
    }
  });
  assert.equal(surface.type, "image.gallery");
  assert.equal(surface.kind, "imageGallery");
  assert.equal(surface.title, "Samseong Noodle House");
  assert.equal(surface.images.length, 2);
  assert.equal(surface.images[0].url, "https://images.example.com/samseong/1.jpg");
});

test("POST /ggui/render accepts either intent wrapper or direct type and payload", async () => {
  await withServer(async (baseUrl) => {
    const restaurantFixture = JSON.parse(await fs.readFile(
      path.join(repoRoot, "fixtures", "ggui", "restaurant-photo-explorer.json"),
      "utf8"
    ));
    const wrapped = await postJson(baseUrl, "/ggui/render", {
      intent: {
        type: "restaurant.photoExplorer",
        payload: restaurantFixture
      }
    });
    assert.equal(wrapped.status, 200);
    assert.equal(wrapped.body.ok, true);
    assert.equal(wrapped.body.surface.kind, "imageGallery");
    assert.equal(wrapped.body.surface.images.length, 2);

    const table = await postJson(baseUrl, "/ggui/render", {
      type: "comparisonTable",
      payload: {
        columns: ["name", { key: "price", label: "Price" }],
        items: [
          { name: "Set A", price: "$12" },
          { name: "Set B", price: "$16" }
        ]
      }
    });
    assert.equal(table.status, 200);
    assert.equal(table.body.ok, true);
    assert.equal(table.body.surface.kind, "comparisonTable");
    assert.equal(table.body.surface.title, undefined);
    assert.equal(table.body.surface.columns[1].label, "Price");
  });
});

test("POST /ggui/render rejects malformed and unsupported intents with typed errors", async () => {
  await withServer(async (baseUrl) => {
    const malformed = await postJson(baseUrl, "/ggui/render", {
      type: "image.gallery",
      payload: { restaurantName: "x", photos: "not-an-array" }
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, "GGUI_RENDER_INVALID");

    const unsupported = await postJson(baseUrl, "/ggui/render", {
      type: "unknown.surface",
      payload: {}
    });
    assert.equal(unsupported.status, 400);
    assert.equal(unsupported.body.error.code, "GGUI_RENDER_INVALID");

    const missingType = await postJson(baseUrl, "/ggui/render", {
      payload: {}
    });
    assert.equal(missingType.status, 400);
    assert.equal(missingType.body.error.code, "GGUI_RENDER_INVALID");
  });
});

test("workflow runtime remains ggui-free and ggui.render stays invalid as a workflow node", async () => {
  const runtimeFiles = [
    path.join(repoRoot, "services/agent-gateway/src/workflows/runner.js"),
    path.join(repoRoot, "services/agent-gateway/src/workflows/node-handlers.js"),
    path.join(repoRoot, "services/agent-gateway/src/workflows/runtime-utils.js")
  ];
  for (const file of runtimeFiles) {
    const source = await fs.readFile(file, "utf8");
    assert.equal(source.includes("ggui"), false);
  }

  await assert.rejects(
    async () => validateWorkflowYaml(
      await fs.readFile(path.join(repoRoot, "fixtures/workflows/ggui-render-node.yml"), "utf8"),
      { filePath: "ggui-render-node.yml" }
    ),
    (error) => error.code === "WORKFLOW_VALIDATION_FAILED"
  );
});

async function withServer(handler) {
  const server = createServer({
    mcpServers: {}
  }, {
    provider: {
      name: "scripted",
      async complete() {
        return { choices: [{ message: { content: "ok" } }] };
      }
    },
    logger: { event: () => {} },
    workspace: { root: repoRoot }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await handler(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postJson(baseUrl, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
