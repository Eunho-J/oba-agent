import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runAgentTurn } from "../src/engine/agent.js";
import { createFileConversationMemoryStore, ConversationMemoryError } from "../src/engine/memory-store.js";

function response(content, id = "resp_test") {
  return { id, choices: [{ message: { content } }] };
}

function scriptedProvider(contents, calls = []) {
  return {
    name: "scripted",
    async complete(request) {
      calls.push(request);
      return response(contents.shift() || "ok");
    }
  };
}

test("conversation memory replays previous turns into provider context", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-memory-replay-"));
  const memoryStore = createFileConversationMemoryStore({ rootPath: root });
  const firstProvider = scriptedProvider(["first answer"]);
  await runAgentTurn({
    message: "remember alpha",
    conversationId: "ctx-replay",
    provider: firstProvider,
    memoryStore,
    logger: { event: () => {} }
  });

  const providerCalls = [];
  await runAgentTurn({
    message: "what next?",
    conversationId: "ctx-replay",
    provider: scriptedProvider(["second answer"], providerCalls),
    memoryStore,
    logger: { event: () => {} }
  });

  try {
    const contents = providerCalls[0].messages.map((message) => message.content).join("\n");
    assert.match(contents, /remember alpha/);
    assert.match(contents, /first answer/);
    const memory = await memoryStore.read("ctx-replay");
    assert.equal(memory.revision, 2);
    assert.equal(memory.turns.length, 2);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("0.9 threshold compacts memory and reports revision/debug metadata", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-memory-compact-"));
  const memoryStore = createFileConversationMemoryStore({ rootPath: root });
  const longText = "긴 컨텍스트 ".repeat(500);

  await runAgentTurn({
    message: longText,
    conversationId: "ctx-compact",
    provider: scriptedProvider(["stored answer"]),
    memoryStore,
    contextOptions: { contextWindowTokens: 1000, compactionThreshold: 0.9 },
    logger: { event: () => {} }
  });

  const result = await runAgentTurn({
    message: `${longText} 다시 확인`,
    conversationId: "ctx-compact",
    provider: scriptedProvider(["compacted answer"]),
    memoryStore,
    contextOptions: { contextWindowTokens: 1000, compactionThreshold: 0.9 },
    logger: { event: () => {} }
  });

  try {
    assert.equal(result.metadata.context.compactionThreshold, 0.9);
    assert.equal(result.metadata.context.memory.preTurnCompaction.triggered, true);
    assert.equal(result.metadata.context.memory.preTurnCompaction.thresholdTokens, 900);
    assert.ok(result.metadata.context.memory.persistedRevision >= 3);
    const memory = await memoryStore.read("ctx-compact");
    assert.match(memory.summary, /current user intent/);
    assert.equal(memory.turns.some((turn) => turn.user.includes("apiKey=secret")), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("same-conversation writes are serialized and corrupt manifests fail actionably", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oba-memory-lock-"));
  const memoryStore = createFileConversationMemoryStore({ rootPath: root });
  await Promise.all(Array.from({ length: 5 }, (_, index) => {
    return memoryStore.update("ctx-lock", (current) => ({
      ...current,
      turns: [...current.turns, { user: `u${index}`, assistant: `a${index}` }]
    }));
  }));
  const memory = await memoryStore.read("ctx-lock");
  assert.equal(memory.revision, 5);
  assert.equal(memory.turns.length, 5);

  const corruptDir = memoryStore.pathFor("ctx-corrupt");
  await fs.mkdir(corruptDir, { recursive: true });
  await fs.writeFile(path.join(corruptDir, "manifest.json"), "{not-json", "utf8");
  await assert.rejects(
    () => memoryStore.read("ctx-corrupt"),
    (error) => {
      assert.ok(error instanceof ConversationMemoryError);
      assert.equal(error.code, "CONVERSATION_MEMORY_CORRUPT");
      return true;
    }
  );
  await fs.rm(root, { recursive: true, force: true });
});
