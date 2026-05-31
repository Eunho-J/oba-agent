import fs from "node:fs/promises";
import path from "node:path";
import { redactMemoryText } from "./engine/memory-store.js";

const DEFAULT_UI_CONVERSATION_ID = "browser-ui";
const TRANSCRIPT_FILE = "ui-transcript.json";
const MAX_TRANSCRIPT_MESSAGES = 120;

export function resolveUiConversationId(value) {
  const conversationId = typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_UI_CONVERSATION_ID;
  if (conversationId.length > 256) {
    const error = new Error("conversationId must be 256 characters or fewer");
    error.code = "CONVERSATION_ID_TOO_LONG";
    error.status = 400;
    throw error;
  }
  return conversationId;
}

export async function readServerTranscript(memoryStore, conversationId) {
  const filePath = transcriptPath(memoryStore, conversationId);
  const raw = await fs.readFile(filePath, "utf8").catch((cause) => {
    if (cause?.code === "ENOENT") return "";
    throw cause;
  });
  if (!raw) {
    return { conversationId, messages: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      conversationId,
      messages: Array.isArray(parsed?.messages)
        ? parsed.messages.map(normalizeStoredMessage).filter(Boolean)
        : []
    };
  } catch (cause) {
    const error = new Error("conversation transcript is corrupt");
    error.code = "CONVERSATION_TRANSCRIPT_CORRUPT";
    error.status = 500;
    error.cause = cause;
    throw error;
  }
}

export async function appendServerTranscript(memoryStore, { conversationId, userMessage, agentResult }) {
  const current = await readServerTranscript(memoryStore, conversationId);
  const next = {
    conversationId,
    updatedAt: new Date().toISOString(),
    messages: [
      ...current.messages,
      createStoredUserMessage(userMessage),
      createStoredAssistantMessage(agentResult)
    ].slice(-MAX_TRANSCRIPT_MESSAGES)
  };
  const dir = memoryStore.pathFor(conversationId);
  await fs.mkdir(dir, { recursive: true });
  await writeJsonAtomic(path.join(dir, TRANSCRIPT_FILE), next);
  return next;
}

export async function resetServerConversation(memoryStore, conversationId) {
  await fs.rm(memoryStore.pathFor(conversationId), { recursive: true, force: true });
  return { conversationId, messages: [] };
}

function transcriptPath(memoryStore, conversationId) {
  return path.join(memoryStore.pathFor(conversationId), TRANSCRIPT_FILE);
}

function normalizeStoredMessage(message) {
  if (!message || typeof message !== "object") return null;
  const role = message.role === "user" ? "user" : message.role === "assistant" ? "assistant" : "";
  const text = typeof message.text === "string" ? message.text : "";
  if (!role || !text) return null;
  return {
    id: typeof message.id === "string" && message.id ? message.id : createMessageId(role),
    role,
    text,
    kind: typeof message.kind === "string" && message.kind ? message.kind : "message",
    metadata: message.metadata && typeof message.metadata === "object" ? message.metadata : {},
    toolCalls: Array.isArray(message.toolCalls) ? message.toolCalls : [],
    provider: message.provider && typeof message.provider === "object" ? message.provider : {},
    gguiAttachments: Array.isArray(message.gguiAttachments) ? message.gguiAttachments : []
  };
}

function createStoredUserMessage(text) {
  return {
    id: createMessageId("user"),
    role: "user",
    text: redactMemoryText(text),
    kind: "message",
    metadata: {},
    toolCalls: [],
    provider: {},
    gguiAttachments: []
  };
}

function createStoredAssistantMessage(result) {
  return {
    id: createMessageId("assistant"),
    role: "assistant",
    text: redactMemoryText(result?.answer || ""),
    kind: "final",
    metadata: result?.metadata || {},
    toolCalls: Array.isArray(result?.toolCalls) ? result.toolCalls : [],
    provider: result?.provider || {},
    gguiAttachments: Array.isArray(result?.gguiAttachments)
      ? result.gguiAttachments
      : result?.surface ? [result.surface] : []
  };
}

function createMessageId(role) {
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}
