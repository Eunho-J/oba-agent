import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { runAgentTurn } from "../src/engine/agent.js";
import { TurnResourceManager } from "../src/engine/resource-manager.js";
import { transcribeVoiceRequest } from "../src/voice/whisper.js";

test("turn timeout aborts hung provider and cleans timers", async () => {
  const manager = new TurnResourceManager({ timeoutMs: 25 });
  const provider = {
    name: "hung",
    complete({ signal }) {
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
  };

  await assert.rejects(
    () => runAgentTurn({
      message: "hang",
      provider,
      resourceManager: manager,
      logger: { event: () => {} }
    }),
    (error) => {
      assert.equal(error.code, "PROVIDER_REQUEST_FAILED");
      assert.equal(error.cause.code, "TURN_TIMEOUT");
      return true;
    }
  );
  const report = manager.report();
  assert.equal(report.aborted, true);
  assert.equal(report.abortCode, "TURN_TIMEOUT");
  assert.equal(report.cleaned, true);
  assert.equal(report.activeTimers, 0);
});

test("resource cleanup is idempotent and removes registered temp paths", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oba-resource-temp-"));
  const manager = new TurnResourceManager({ timeoutMs: 0 });
  manager.registerTempPath(tempDir);
  await manager.cleanup();
  await manager.cleanup();
  await assert.rejects(() => fs.stat(tempDir), /ENOENT/);
  assert.equal(manager.report().cleanupErrors.length, 0);
});

test("multipart voice temp upload is cleaned after transcription", async () => {
  let uploadedPath = "";
  const boundary = "oba-boundary";
  const body = [
    `--${boundary}`,
    "Content-Disposition: form-data; name=\"audio\"; filename=\"sample.wav\"",
    "Content-Type: audio/wav",
    "",
    "RIFF....WAVEfmt ",
    `--${boundary}--`,
    ""
  ].join("\r\n");
  const req = Readable.from(Buffer.from(body, "binary"));
  req.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };

  const result = await transcribeVoiceRequest(req, {
    transcriber: async (upload) => {
      uploadedPath = upload.path;
      assert.equal((await fs.stat(upload.path)).isFile(), true);
      return { ok: true, text: "voice ok" };
    }
  });

  assert.equal(result.text, "voice ok");
  await assert.rejects(() => fs.stat(path.dirname(uploadedPath)), /ENOENT/);
});
