import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm"]);
const AUDIO_CONTENT_PREFIX = "audio/";

export class VoiceInputError extends Error {
  constructor(message, { code = "VOICE_INPUT_ERROR", status = 400, cause, details } = {}) {
    super(message, { cause });
    this.name = "VoiceInputError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function transcribeVoiceRequest(req, {
  config = {},
  transcriber = defaultWhisperTranscriber
} = {}) {
  const contentType = String(req.headers["content-type"] || "");
  const maxBytes = config.uploadMaxBytes ?? 10 * 1024 * 1024;
  const upload = contentType.startsWith("multipart/form-data")
    ? await readMultipartAudio(req, contentType, maxBytes)
    : await readJsonAudioPath(req);
  validateAudioUpload(upload);
  try {
    return await transcriber(upload, config);
  } finally {
    if (upload.cleanupPath) {
      await fs.rm(upload.cleanupPath, { recursive: true, force: true });
    }
  }
}

export async function defaultWhisperTranscriber(upload, config = {}) {
  const binary = config.whisperBin || "whisper-cli";
  const args = [
    ...(config.whisperModel ? ["-m", config.whisperModel] : []),
    ...(Array.isArray(config.whisperExtraArgs) ? config.whisperExtraArgs : []),
    "-f",
    upload.path
  ];
  const result = await runCommand(binary, args);
  const text = extractWhisperText(result.stdout || result.stderr);
  if (!text) {
    throw new VoiceInputError("whisper.cpp did not return transcript text", {
      code: "VOICE_TRANSCRIPT_EMPTY",
      status: 502,
      details: { binary, args }
    });
  }
  return {
    ok: true,
    text,
    provider: "whisper.cpp",
    command: { binary, args },
    audio: uploadSummary(upload)
  };
}

async function readJsonAudioPath(req) {
  const raw = await readRaw(req, 64 * 1024);
  let body;
  try {
    body = raw.length > 0 ? JSON.parse(raw.toString("utf8")) : {};
  } catch (cause) {
    throw new VoiceInputError("request body must be valid JSON or multipart/form-data", {
      code: "VOICE_REQUEST_INVALID",
      cause
    });
  }
  if (typeof body.audioPath !== "string" || body.audioPath.trim().length === 0) {
    throw new VoiceInputError("audioPath must be a non-empty string for JSON transcription requests", {
      code: "VOICE_AUDIO_PATH_REQUIRED"
    });
  }
  const audioPath = path.resolve(body.audioPath);
  const stat = await fs.stat(audioPath).catch((cause) => {
    throw new VoiceInputError("audioPath does not exist", { code: "VOICE_AUDIO_NOT_FOUND", cause });
  });
  return {
    path: audioPath,
    filename: path.basename(audioPath),
    contentType: typeof body.contentType === "string" ? body.contentType : guessContentType(audioPath),
    size: stat.size
  };
}

async function readMultipartAudio(req, contentType, maxBytes) {
  const boundaryMatch = contentType.match(/boundary=([^;]+)/u);
  if (!boundaryMatch) {
    throw new VoiceInputError("multipart/form-data request is missing boundary", { code: "VOICE_MULTIPART_BOUNDARY_REQUIRED" });
  }
  const boundary = boundaryMatch[1].replace(/^"|"$/gu, "");
  const raw = await readRaw(req, maxBytes);
  const parts = raw.toString("binary").split(`--${boundary}`);
  for (const part of parts) {
    if (!part.includes("name=\"audio\"")) continue;
    const [rawHeaders, rawBody = ""] = part.split("\r\n\r\n");
    const headers = rawHeaders || "";
    const filename = headerValue(headers, "filename") || "voice-upload.wav";
    const contentTypeValue = contentTypeHeader(headers) || guessContentType(filename);
    const content = Buffer.from(rawBody.replace(/\r\n$/u, ""), "binary");
    if (content.length === 0) continue;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oba-voice-"));
    const audioPath = path.join(tempDir, safeFilename(filename));
    await fs.writeFile(audioPath, content);
    return {
      path: audioPath,
      filename,
      contentType: contentTypeValue,
      size: content.length,
      cleanupPath: tempDir
    };
  }
  throw new VoiceInputError("multipart/form-data must include an audio file field named audio", {
    code: "VOICE_AUDIO_FILE_REQUIRED"
  });
}

async function readRaw(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new VoiceInputError("audio upload is too large", {
        code: "VOICE_UPLOAD_TOO_LARGE",
        details: { maxBytes }
      });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function validateAudioUpload(upload) {
  const extension = path.extname(upload.filename || upload.path).toLowerCase();
  const isAudioContent = String(upload.contentType || "").startsWith(AUDIO_CONTENT_PREFIX);
  if (!isAudioContent && !AUDIO_EXTENSIONS.has(extension)) {
    throw new VoiceInputError("voice input must be an audio file", {
      code: "VOICE_UPLOAD_NOT_AUDIO",
      details: { filename: upload.filename, contentType: upload.contentType }
    });
  }
}

function headerValue(headers, name) {
  const match = headers.match(new RegExp(`${name}="([^"]+)"`, "iu"));
  return match?.[1] || "";
}

function contentTypeHeader(headers) {
  const match = headers.match(/content-type:\s*([^\r\n]+)/iu);
  return match?.[1]?.trim() || "";
}

function safeFilename(filename) {
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]+/gu, "_") || "voice-upload.wav";
}

function guessContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".wav") return "audio/wav";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".m4a") return "audio/mp4";
  if (extension === ".flac") return "audio/flac";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".webm") return "audio/webm";
  return "application/octet-stream";
}

function uploadSummary(upload) {
  return {
    filename: upload.filename,
    contentType: upload.contentType,
    size: upload.size,
    path: upload.path
  };
}

function extractWhisperText(output) {
  return String(output || "")
    .split("\n")
    .map((line) => line.replace(/^\[[^\]]+\]\s*/u, "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (cause) => {
      reject(new VoiceInputError(`failed to start whisper.cpp binary: ${command}`, {
        code: "VOICE_WHISPER_UNAVAILABLE",
        status: 502,
        cause,
        details: { command, args }
      }));
    });
    child.on("close", (code) => {
      const result = {
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      reject(new VoiceInputError(`whisper.cpp exited with code ${code}`, {
        code: "VOICE_WHISPER_FAILED",
        status: 502,
        details: { command, args, ...result }
      }));
    });
  });
}
