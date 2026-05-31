import assert from "node:assert/strict";
import test from "node:test";
import { createOpenAICompatibleProvider, deriveHealthUrl } from "../src/engine/provider.js";

const runProviderTests = process.env.OBA_RUN_CODEX_AS_API_TESTS === "1";

test("codex-as-api health and minimal chat completion contract", { skip: !runProviderTests }, async () => {
  const baseUrl = process.env.OBA_PROVIDER_BASE_URL || "http://127.0.0.1:18080/v1";
  const healthUrl = deriveHealthUrl(baseUrl);
  const health = await fetch(healthUrl);
  assert.equal(health.ok, true, "codex-as-api health endpoint must be reachable");
  const healthBody = await health.json();
  assert.equal(healthBody.status, "ok", "codex-as-api health status changed");
  assert.equal(healthBody.auth_available, true, "codex-as-api OAuth auth is not available");

  const provider = createOpenAICompatibleProvider({
    baseUrl,
    model: process.env.OBA_PROVIDER_MODEL || "gpt-5.5",
    apiKey: process.env.OBA_PROVIDER_API_KEY || "unused"
  });
  const response = await provider.complete({
    messages: [
      { role: "system", content: "Reply with one short sentence." },
      { role: "user", content: "Say ready." }
    ],
    tools: []
  });

  assert.equal(typeof response.choices?.[0]?.message?.content, "string");
});

test("deriveHealthUrl follows provider base URL unless overridden", () => {
  assert.equal(deriveHealthUrl("http://127.0.0.1:18080/v1"), "http://127.0.0.1:18080/health");
});
