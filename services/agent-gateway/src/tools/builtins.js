import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import { ToolExecutionError } from "./errors.js";
import { createWorkspace } from "./workspace.js";
import { renderGguiSurface } from "../ggui/render.js";
import { searchImageResults } from "../ggui/image-search.js";

const execFileAsync = promisify(execFile);

export function createBuiltInTools({ workspace = createWorkspace(), fetchImpl = fetch } = {}) {
  return [
    createReadTool(workspace),
    createWriteTool(workspace),
    createEditTool(workspace),
    createBashTool(workspace),
    createWebSearchTool(fetchImpl),
    createSearchImagesTool(fetchImpl),
    createGguiRenderSurfaceTool()
  ];
}

function baseTool({ name, description, parameters, risk, execute }) {
  return {
    name,
    description,
    parameters,
    risk,
    requiresApproval: risk !== "read-only",
    executorId: `builtin.${name}`,
    version: "1.0.0",
    provenance: "builtin",
    execute
  };
}

function createReadTool(workspace) {
  return baseTool({
    name: "read",
    description: "Read a UTF-8 text file inside the configured workspace root.",
    risk: "read-only",
    parameters: objectSchema({
      path: { type: "string", description: "Workspace-relative path to read." }
    }, ["path"]),
    async execute(args = {}) {
      const { realPath } = await workspace.resolveExisting(requiredString(args.path, "path"));
      const content = await fs.readFile(realPath, "utf8");
      return { path: args.path, content };
    }
  });
}

function createWriteTool(workspace) {
  return baseTool({
    name: "write",
    description: "Create or overwrite a UTF-8 text file inside the configured workspace root.",
    risk: "idempotent-write",
    parameters: objectSchema({
      path: { type: "string", description: "Workspace-relative path to write." },
      content: { type: "string", description: "Full UTF-8 file content." }
    }, ["path", "content"]),
    async execute(args = {}) {
      const target = await workspace.resolveWritableFile(requiredString(args.path, "path"));
      await fs.writeFile(target.resolvedPath, requiredString(args.content, "content"), "utf8");
      return { path: args.path, bytes: Buffer.byteLength(args.content, "utf8") };
    }
  });
}

function createEditTool(workspace) {
  return baseTool({
    name: "edit",
    description: "Apply an exact text replacement to a UTF-8 file inside the configured workspace root.",
    risk: "idempotent-write",
    parameters: objectSchema({
      path: { type: "string", description: "Workspace-relative path to edit." },
      oldText: { type: "string", description: "Exact text to replace." },
      newText: { type: "string", description: "Replacement text." },
      replaceAll: { type: "boolean", description: "Replace every match. Defaults to false." }
    }, ["path", "oldText", "newText"]),
    async execute(args = {}) {
      const { realPath } = await workspace.resolveExisting(requiredString(args.path, "path"));
      const oldText = requiredString(args.oldText, "oldText");
      const content = await fs.readFile(realPath, "utf8");
      const matches = countOccurrences(content, oldText);
      if (matches === 0) {
        throw new ToolExecutionError("oldText was not found", {
          code: "EDIT_TARGET_NOT_FOUND",
          details: { path: args.path }
        });
      }
      if (!args.replaceAll && matches !== 1) {
        throw new ToolExecutionError("oldText matched multiple locations", {
          code: "EDIT_TARGET_AMBIGUOUS",
          details: { path: args.path, matches }
        });
      }
      const updated = args.replaceAll ? content.split(oldText).join(args.newText) : content.replace(oldText, args.newText);
      await fs.writeFile(realPath, updated, "utf8");
      return { path: args.path, replacements: args.replaceAll ? matches : 1 };
    }
  });
}

function createBashTool(workspace) {
  return baseTool({
    name: "bash",
    description: "Run a trusted local shell command from inside the configured workspace root.",
    risk: "high-risk-write",
    parameters: objectSchema({
      command: { type: "string", description: "Shell command to run." },
      cwd: { type: "string", description: "Optional workspace-relative working directory." },
      timeoutMs: { type: "integer", description: "Timeout in milliseconds. Default 30000, max 120000." }
    }, ["command"]),
    async execute(args = {}) {
      const cwd = args.cwd ? (await workspace.resolveExisting(args.cwd, "cwd")).realPath : workspace.root;
      const timeoutMs = clampTimeout(args.timeoutMs);
      try {
        const result = await execFileAsync(shellPath(), ["-lc", requiredString(args.command, "command")], {
          cwd,
          timeout: timeoutMs,
          env: buildToolEnv(process.env),
          maxBuffer: 1024 * 1024
        });
        return { stdout: result.stdout, stderr: result.stderr, exitCode: 0, cwd, timeoutMs };
      } catch (error) {
        if (error?.killed || error?.signal === "SIGTERM") {
          throw new ToolExecutionError("bash command timed out", {
            code: "TOOL_TIMEOUT",
            cause: error,
            details: { cwd, timeoutMs }
          });
        }
        return {
          stdout: error?.stdout || "",
          stderr: error?.stderr || "",
          exitCode: typeof error?.code === "number" ? error.code : 1,
          cwd,
          timeoutMs
        };
      }
    }
  });
}

function createSearchImagesTool(fetchImpl) {
  return baseTool({
    name: "search_images",
    description: [
      "Search an external image source and return structured image data.",
      "This is only one optional data-source tool; call ggui_render_surface afterward when the result should be shown as UI."
    ].join(" "),
    risk: "read-only",
    parameters: objectSchema({
      query: { type: "string", description: "External image search query." },
      limit: { type: "integer", description: "Maximum number of photos, 1-12. Defaults to 4." }
    }, ["query"]),
    async execute(args = {}) {
      return searchImageResults({
        query: requiredString(args.query, "query"),
        limit: args.limit,
        fetchImpl
      });
    }
  });
}

function createWebSearchTool(fetchImpl) {
  return baseTool({
    name: "web_search",
    description: [
      "Search the live web for current or external information and return structured result links.",
      "Use this before ggui_render_surface when web findings should be organized as an inline UI."
    ].join(" "),
    risk: "read-only",
    parameters: objectSchema({
      query: { type: "string", description: "Web search query." },
      limit: { type: "integer", description: "Maximum number of results, 1-10. Defaults to 5." }
    }, ["query"]),
    async execute(args = {}) {
      const query = requiredString(args.query, "query");
      const limit = clampLimit(args.limit, 5, 10);
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      let response;
      try {
        response = await fetchImpl(url, {
          headers: {
            "User-Agent": "oba-agent-web-search/1.0"
          }
        });
      } catch (cause) {
        throw new ToolExecutionError("web search request failed", {
          code: "WEB_SEARCH_REQUEST_FAILED",
          cause
        });
      }
      if (!response?.ok) {
        throw new ToolExecutionError("web search request returned an error", {
          code: "WEB_SEARCH_FAILED",
          details: { status: response?.status }
        });
      }
      const html = typeof response.text === "function"
        ? await response.text()
        : JSON.stringify(await response.json?.() || {});
      return {
        source: "duckduckgo-html",
        query,
        results: parseDuckDuckGoHtml(html).slice(0, limit)
      };
    }
  });
}

function createGguiRenderSurfaceTool() {
  return baseTool({
    name: "ggui_render_surface",
    description: [
      "Build a dynamic UI surface from prepared data and attach it to the assistant answer.",
      "Use this after any file, parser, algorithm, shell command, workflow, MCP tool, external search, or prior tool result should be displayed as UI.",
      "Supported surface types include image.gallery and comparison.table."
    ].join(" "),
    risk: "read-only",
    parameters: objectSchema({
      type: { type: "string", description: "Surface type such as image.gallery or comparison.table." },
      payload: { type: "object", description: "Renderer-neutral surface payload for the selected type." }
    }, ["type", "payload"]),
    async execute(args = {}) {
      const surface = renderGguiSurface({
        type: requiredString(args.type, "type"),
        payload: requiredObject(args.payload, "payload")
      });
      return {
        kind: "ggui.surface",
        surface
      };
    }
  });
}

function parseDuckDuckGoHtml(html) {
  const results = [];
  const anchorPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu;
  const anchors = [...html.matchAll(anchorPattern)];
  for (let index = 0; index < anchors.length; index += 1) {
    const match = anchors[index];
    const nextIndex = anchors[index + 1]?.index ?? html.length;
    const block = html.slice((match.index || 0) + match[0].length, nextIndex);
    const snippetMatch = block.match(/<(?:a|div)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/iu);
    const url = normalizeSearchUrl(decodeHtml(match[1] || ""));
    const title = cleanHtml(match[2] || "");
    const snippet = cleanHtml(snippetMatch?.[1] || "");
    if (url && title) results.push({ title, url, snippet });
  }
  return results;
}

function normalizeSearchUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const redirected = parsed.searchParams.get("uddg");
    return redirected ? decodeURIComponent(redirected) : parsed.href;
  } catch {
    return rawUrl;
  }
}

function cleanHtml(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim());
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">");
}

function objectSchema(properties, required) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ToolExecutionError(`${name} must be a non-empty string`, {
      code: "TOOL_ARGUMENT_INVALID",
      details: { argument: name }
    });
  }
  return value;
}

function requiredObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolExecutionError(`${name} must be an object`, {
      code: "TOOL_ARGUMENT_INVALID",
      details: { argument: name }
    });
  }
  return value;
}

function countOccurrences(content, needle) {
  return content.split(needle).length - 1;
}

function clampTimeout(value) {
  if (value === undefined) return 30_000;
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new ToolExecutionError("timeoutMs must be a positive number", {
      code: "TOOL_ARGUMENT_INVALID",
      details: { argument: "timeoutMs" }
    });
  }
  return Math.min(timeout, 120_000);
}

function clampLimit(value, defaultValue, maxValue) {
  if (value === undefined) return defaultValue;
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new ToolExecutionError("limit must be a positive number", {
      code: "TOOL_ARGUMENT_INVALID",
      details: { argument: "limit" }
    });
  }
  return Math.min(Math.floor(limit), maxValue);
}

function shellPath() {
  if (os.platform() === "darwin") return "/bin/bash";
  return process.env.SHELL || "/bin/sh";
}

function buildToolEnv(env) {
  const allowed = {};
  for (const key of ["PATH", "HOME", "SHELL", "USER", "TMPDIR"]) {
    if (env[key]) allowed[key] = env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("OBA_TOOL_ENV_")) {
      allowed[key.slice("OBA_TOOL_ENV_".length)] = value;
    }
  }
  return allowed;
}
