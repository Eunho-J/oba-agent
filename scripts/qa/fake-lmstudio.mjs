#!/usr/bin/env node
import http from "node:http";

const args = process.argv.slice(2);
const port = Number(readFlag(args, "--port") || 9123);
if (!Number.isInteger(port) || port <= 0) {
  console.error("invalid --port value");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return writeJson(res, 200, { ok: true });
  }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    return writeJson(res, 404, { error: "not_found" });
  }
  let body;
  try {
    body = await readJson(req);
  } catch {
    return writeJson(res, 400, { error: "invalid_json" });
  }

  const model = String(body?.model || "unknown-model");
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const userText = extractUserText(messages);
  const mode = body?.metadata?.mode || inferMode(messages);
  const labels = Array.isArray(body?.metadata?.labels)
    ? body.metadata.labels.filter(Boolean).map(String)
    : [];

  const content = mode === "llm.classify" && labels.length > 0
    ? chooseLabel(userText, labels)
    : `fake-lmstudio:${model}:${compact(userText).slice(0, 60) || "empty-input"}`;

  return writeJson(res, 200, {
    id: "chatcmpl_fake_lmstudio",
    object: "chat.completion",
    created: 1730000000,
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: Math.max(1, content.length / 5),
      total_tokens: 20
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`fake-lmstudio listening on http://127.0.0.1:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

function readFlag(values, name) {
  const index = values.indexOf(name);
  if (index < 0 || index + 1 >= values.length) return null;
  return values[index + 1];
}

function writeJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function extractUserText(messages) {
  return messages
    .filter((message) => message?.role === "user")
    .map((message) => String(message?.content || ""))
    .join(" ")
    .trim();
}

function inferMode(messages) {
  const systemContent = messages
    .filter((message) => message?.role === "system")
    .map((message) => String(message?.content || ""))
    .join(" ");
  return /\blabels?\s*:/.test(systemContent) ? "llm.classify" : "llm.prompt";
}

function chooseLabel(text, labels) {
  if (labels.includes("schedule_change") && /다음\s*주|미루|연기|일정/.test(text)) {
    return "schedule_change";
  }
  const index = stableHash(text) % labels.length;
  return labels[index];
}

function stableHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
