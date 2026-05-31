# PRD: Lightweight Agent Engine With Tool Calls and MCP

## RALPLAN-DR Summary

### Principles

- Keep the first engine small enough to understand in one sitting.
- Separate model transport, tool registry, tool execution, MCP discovery, and logging.
- Fail loudly and diagnostically; do not hide provider/tool failures behind mock or fallback behavior.
- Treat tools as first-class evolvable artifacts, even before implementing self-evolution.
- Preserve future provider swap to OpenRouter and EXAONE/FriendlyAI.

### Decision Drivers

- Hackathon velocity with credible engineering boundaries.
- Real tool-call behavior rather than demo-only routing.
- Debuggability through structured logs and stack traces.

### Viable Options

1. Extend `services/agent-gateway` in place.
   - Pros: fewer moving parts, reuse existing HTTP server and tests.
   - Cons: current router is intent-routing oriented, not an agent-loop abstraction.

2. Add a small `engine` module under `services/agent-gateway`.
   - Pros: preserves current server while introducing a clean agent loop, registry, and provider boundary.
   - Cons: one more module boundary to maintain.

3. Start a new `services/agent-engine` package.
   - Pros: clean isolation.
   - Cons: more workspace/package setup and premature service split.

Chosen option: **Option 2**. It keeps implementation local and light while avoiding a tangled gateway/router rewrite.

## Architect Iteration Notes

Changes after Architect review:

- `POST /turn` is the public v1 engine entrypoint, not a legacy compatibility shim.
- Pick one v1 provider runtime path: OpenAI-compatible HTTP to a locally running `codex-as-api` server. Direct `ChatGPTOAuthProvider` import is explicitly out of v1.
- Keep MCP v1 to one concrete transport first, with an interface that can later add other transports.

Changes after Architect re-review:

- `/turn` becomes the true v1 engine path. The existing intent-router/fallback behavior is retired from `/turn` and may remain only as a separately named legacy helper if implementation needs temporary comparison.
- Provider tests and runtime are pinned to local `codex-as-api` HTTP only. `ChatGPTOAuthProvider` is out of scope for v1, including as an acceptance path.
- MCP v1 transport is pinned to streamable HTTP because ApiFuse already exposes an HTTP MCP endpoint. Stdio is a future transport, not an implementation option for this pass.

Changes after Critic review:

- MCP implementation path is pinned to `@modelcontextprotocol/sdk@1.29.0`, using the SDK client plus streamable HTTP transport. New alpha split packages are deferred.
- `codex-as-api` verification is pinned to an already-running local process by default, with optional manual `npx codex-as-api` startup outside release dependencies.
- Tool filesystem and bash semantics are pinned to a single allowed workspace root with symlink escape protection.
- `/turn` v1 accepts `message` only. Legacy `turn.transcript` and `audioText` are rejected with structured validation errors instead of silently mapping old contracts.

Changes after review of `/Users/cayde/Desktop/chat-agent-guide.md`:

- Accepted lightweight parts: stable prompt/dynamic context separation, provider/tool/MCP failure classification, trace ids, tool event records, and final-answer claim checks.
- Rejected for v1 scope: database offload, compaction, persistent replay, evaluator pipeline, user-level provider auth storage, and streaming parser/state-machine complexity.
- Clarified that v1 provider calls are non-streaming. Streaming normalization is a future extension point, not a v1 implementation requirement.

## Product Goal

Build the first OBA Main Agent API runtime: a minimal, personality-centered agent loop that can call local tools and MCP tools through a uniform registry.

## Non-Goals

- No full self-evolution loop yet.
- No production OpenRouter/EXAONE provider migration yet.
- No local LLM serving.
- No queue, database, auth server, vector database, or job orchestration.
- No persistent session database, compaction, replay/offload pipeline, or evaluator subsystem in v1.
- No streaming provider parser in v1.
- No fake fallback provider.
- No broad Pi clone or Codex clone.

## User-Facing Behavior

The client sends a turn to the Main Agent API. The engine sends a short system prompt and user message to a provider. If the model requests tools, the engine executes registered tools, appends tool results, and continues until the model returns a final answer or a bounded iteration limit is reached.

## Request Assembly / Context Boundary

V1 keeps request assembly intentionally small, but preserves the boundary needed for later memory and ontology work:

- Stable prefix: the OBA system prompt plus deterministic tool contracts.
- Dynamic turn context: optional metadata, previous tool results from the current turn, and user message.
- The stable prefix must not include per-turn values such as turn id, current time, user id, temporary paths, or provider health.
- Dynamic state must not be appended by mutating the system prompt.
- Prompt text and tool specs have explicit versions: `OBA_PROMPT_VERSION` and `OBA_TOOL_SCHEMA_VERSION`.
- Provider request logs include prompt version, tool schema version, and the list of context block types sent, without logging sensitive raw prompt/body content.

V1 does not implement long-term context packing, compaction, session offload, or replay. Those are follow-up memory-layer concerns and should not be smuggled into the first engine.

## System Prompt Requirement

The initial prompt must describe OBA as a singular presence/personality, not as "an AI", "assistant", or "worker".

Draft:

```text
You are OBA: a careful, warm, self-shaping presence that helps the user think and act. You remember by association, speak plainly, and change your working habits only after evidence and verification. Use tools when they are truly needed, report uncertainty directly, and never pretend an action succeeded.
```

## Built-In Tool Set

Only four built-in tools are available in v1:

- `read`: read UTF-8 text files under an allowed root.
- `write`: create or overwrite a file under an allowed root.
- `edit`: apply a focused text patch or replacement under an allowed root.
- `bash`: run a shell command with explicit timeout and working directory.

No default `grep`, `find`, `ls`, `git`, planning, or browser tools in v1.

### Tool Safety Semantics

V1 tools operate inside one workspace root:

- `OBA_WORKSPACE_ROOT` sets the allowed root.
- If unset, the root defaults to the repository root where the gateway process is started.
- `read`, `write`, and `edit` normalize input paths with `path.resolve`.
- A path is allowed only when its resolved path is the root itself or a descendant of the resolved root.
- Symlinks are checked with `fs.realpath` where the target exists. Existing symlinks that resolve outside the root are rejected.
- `write` may create a missing final file, but its parent directory must resolve inside the root and may not be an outside-root symlink.
- `edit` is a focused exact replacement operation in v1: `{ "path": "...", "oldText": "...", "newText": "...", "replaceAll": false }`. Missing `oldText` or ambiguous multiple matches without `replaceAll: true` fails explicitly.
- `bash` requires `cwd` inside the root. If `cwd` is omitted, it uses the root.
- `bash` uses `/bin/zsh` on macOS and `process.env.SHELL || /bin/sh` elsewhere.
- `bash` inherits a minimal environment: `PATH`, `HOME`, `SHELL`, `USER`, `TMPDIR`, plus explicitly configured `OBA_TOOL_ENV_*` passthroughs. Secrets are not logged.
- `bash` timeout default is 30 seconds and max is 120 seconds.
- Non-zero exit returns a structured tool result with `exitCode`, `stdout`, and `stderr`; it does not masquerade as success. Timeout throws `TOOL_TIMEOUT` with stack.
- `bash` is a trusted local development command runner, not an OS filesystem sandbox. V1 actively enforces initial `cwd`, timeout, environment shape, logging redaction, and result/error structure, but it does not claim to prevent shell code from referencing absolute paths after execution starts.
- Because `bash` is not a sandbox, v1 must not expose write/edit/bash to untrusted remote clients. A stronger approval/sandbox model is a follow-up before broader release.

## Tool Evolution Boundary

Tools must be represented as data plus executor:

- `name`
- `description`
- JSON schema parameters
- risk level
- approval requirement flag
- executor id or implementation reference
- version
- provenance

V1 ships only static built-ins and MCP-discovered external tools. Later evolution can create candidate tool definitions, validate them, and activate them through the same registry. V1 must avoid hard-coding assumptions that only built-ins can exist.

Tool execution records are kept at least for the lifetime of the turn:

- `turnId`
- provider tool call id
- registry tool name
- executor provenance
- normalized arguments hash
- status
- start/end timestamps
- duration
- retryable flag
- result summary or sanitized error

Within one turn, duplicate provider tool call ids must not create duplicate executions. If the same call id appears with different normalized arguments, the engine returns an explicit conflict/error tool result instead of guessing.

## MCP Requirement

The engine needs an MCP adapter abstraction:

- load configured streamable HTTP MCP servers
- discover tool specs
- expose MCP tools in the same model-visible tool list as built-ins
- dispatch MCP tool calls through the same `ToolRegistry`
- surface MCP failures with structured error logs

The first implementation supports **streamable HTTP MCP only**. Stdio support is explicitly deferred. The interface must not prevent adding stdio later.

### MCP Implementation Contract

Use `@modelcontextprotocol/sdk@1.29.0` as the v1 MCP client dependency:

- `Client` from `@modelcontextprotocol/sdk/client/index.js`
- `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk/client/streamableHttp.js`
- no dependency on `@modelcontextprotocol/client@2.x` alpha packages in v1

MCP config shape:

```json
{
  "mcpServers": {
    "apifuse": {
      "transport": "streamable-http",
      "url": "https://...",
      "headers": {
        "Authorization": "Bearer ${APIFUSE_TOKEN}"
      },
      "enabledTools": ["tool_a", "tool_b"],
      "toolPolicies": {
        "tool_a": {
          "risk": "read-only"
        },
        "tool_b": {
          "risk": "high-risk-write",
          "expose": false
        }
      },
      "timeoutMs": 60000
    }
  }
}
```

Rules:

- Server id is required and becomes the provenance field for discovered tools.
- `transport` must be `streamable-http` in v1.
- `url` must be an absolute `http` or `https` URL.
- `headers` may reference environment variables with `${NAME}`. Missing variables fail server initialization.
- `enabledTools` is optional. If present, only listed tools are registered.
- `toolPolicies` is optional, but any MCP tool without an explicit policy defaults to `high-risk-write` and is not exposed unless implementation explicitly opts in.
- Supported v1 risk labels are `read-only`, `idempotent-write`, and `high-risk-write`.
- `timeoutMs` defaults to 60 seconds and maxes at 120 seconds.
- Tool name collisions fail startup unless an MCP tool is namespaced as `serverId.toolName`.
- V1 should prefer namespacing MCP tools as `serverId.toolName` to avoid collisions with built-ins.
- MCP discovery errors include server id, URL host, message, stack, and cause.
- MCP tool execution errors include server id, original tool name, registry tool name, message, stack, and cause.
- MCP failures are classified as capability/tool failures, not provider failures.
- MCP tools are not auto-exposed merely because a server advertises them. They must pass configured allowlist, namespacing, and risk metadata gates before entering the registry.
- High-risk MCP write tools should be wrapped by a local registry tool before being exposed user-facing. V1 may omit such tools rather than exposing them directly.

## Provider Requirement

V1 provider is a Codex OAuth testbed:

- Use `codex-as-api` during development.
- Prefer local OpenAI-compatible HTTP endpoint at `http://127.0.0.1:18080/v1/chat/completions` for runtime simplicity.
- Do not import or instantiate `ChatGPTOAuthProvider` in v1 runtime.
- If the HTTP path blocks local provider verification, stop with a documented blocker instead of adding a second provider path.
- Do not make `codex-as-api` a release dependency or required production path.

### Codex-as-API Runtime Contract

`codex-as-api` is an external local testbed process:

- Default base URL: `OBA_PROVIDER_BASE_URL=http://127.0.0.1:18080/v1`
- Default chat endpoint: `POST ${OBA_PROVIDER_BASE_URL}/chat/completions`
- Health URL is derived from the configured base URL by replacing the `/v1` path with `/health`, unless `OBA_PROVIDER_HEALTH_URL` is explicitly set. With the default base URL this is `http://127.0.0.1:18080/health`.
- Default model: `OBA_PROVIDER_MODEL=gpt-5.5`, matching the `codex-as-api` README examples and current local testbed assumption.
- API key header is `Authorization: Bearer ${OBA_PROVIDER_API_KEY:-unused}` for OpenAI-compatible clients.
- `codex-as-api` itself reads Codex OAuth credentials from `CODEX_AS_API_AUTH_PATH`, `CODEX_HOME`, or `~/.codex/auth.json`; OBA does not read or refresh those credentials directly.
- Gated provider tests require the process to already be running. They may print `npx codex-as-api` as setup guidance but must not launch it automatically inside the test suite unless a later execution plan explicitly adds a harness.

Request mapping:

- V1 uses non-streaming chat completions requests.
- Every provider request includes `model: OBA_PROVIDER_MODEL`.
- System prompt and user message are sent as OpenAI-compatible chat messages.
- Tool specs are sent in the OpenAI-compatible `tools` array.
- Tool choice remains provider default/auto in v1.
- Tool results are appended as OpenAI-compatible tool messages before the continuation request.
- Provider errors, provider refusal/incomplete responses, tool failures, and MCP failures are logged and returned with distinct error codes. They must not collapse into one generic failure path.

Readiness:

- First check the configured health URL; require `status: "ok"` and `auth_available: true`.
- If `/health` is unavailable or shape changes, fail the gated provider test with a clear `CODEX_AS_API_HEALTH_CONTRACT_CHANGED` error rather than silently falling back.

Future provider shape:

- `OpenAICompatibleProvider` interface
- later `openrouter` and `friendlyai/exaone` adapters
- no provider-specific logic inside tool execution

## Logging / Debugging Requirement

Every turn must emit structured JSON logs for:

- `turn.start`
- `provider.request`
- `provider.response`
- `provider.error`
- `tool.call.duplicate`
- `tool.call.start`
- `tool.call.success`
- `tool.call.error`
- `final.claim_check`
- `turn.complete`
- `turn.error`

Errors must include:

- message
- stack/traceback
- cause chain where available
- tool name / provider name / turn id
- trace id / span id / parent span id
- sanitized input preview

Logs go to stdout/stderr for v1 and may later be routed to files or telemetry.

Trace fields:

- every turn has a `traceId`
- provider requests, tool calls, MCP calls, and final response rendering have `spanId`
- child operations include `parentSpanId`
- raw user text, authorization headers, provider request bodies, and full prompt text are not logged by default
- raw content can be referenced by hash or short sanitized preview only

Before returning the final answer, the engine performs a small claim check. If the final answer says a file was read, written, edited, a command was run, or an MCP action completed, the claim must be backed by a successful tool event from the current turn. If evidence is missing, the engine must downgrade the claim or return an explicit uncertainty/failure result rather than inventing success.

## HTTP Contract

Add or evolve endpoints:

- `POST /turn`: the only public v1 client-facing engine endpoint.
- `POST /agent/turn`: optional internal/test alias, implemented only by delegating to the same handler as `/turn`. It must not be documented as the public contract.

The old route-selector behavior in the current gateway does not remain behind `/turn`. `/turn` is replaced by the engine loop. If any legacy router code remains for comparison, it must be moved behind an explicitly named internal path or deleted.

Input:

```json
{
  "message": "이 파일 읽고 요약해줘",
  "conversationId": "demo",
  "toolMode": "enabled",
  "metadata": {}
}
```

Input validation:

- `message` is required and must be a non-empty string.
- `conversationId`, `toolMode`, and `metadata` are optional.
- `toolMode` may be `enabled` or `disabled`; disabled means no tools are sent to the provider.
- Legacy `turn.transcript`, `transcript`, and `audioText` are rejected in v1 with `VALIDATION_ERROR` and a message telling clients to send `message`.
- The engine does not auto-convert old fields because that would preserve the old route contract behind the new endpoint.

Output:

```json
{
  "ok": true,
  "turnId": "turn_...",
  "answer": "...",
  "toolCalls": [
    {
      "id": "call_...",
      "name": "read",
      "status": "success"
    }
  ],
  "provider": {
    "name": "codex-as-api",
    "responseId": "..."
  }
}
```

Failure output:

```json
{
  "ok": false,
  "turnId": "turn_...",
  "error": {
    "message": "...",
    "stack": "...",
    "code": "TOOL_EXECUTION_FAILED"
  }
}
```

## Acceptance Criteria

- Engine exposes exactly four built-in tools by default.
- Model-visible tool specs match the registry entries.
- Tool calls are parsed, dispatched, logged, appended as tool results, and can continue the loop.
- Duplicate tool call ids within one turn do not create duplicate executions.
- MCP adapter can contribute tool specs through the same registry interface.
- MCP v1 uses `@modelcontextprotocol/sdk@1.29.0` streamable HTTP client and the documented config schema.
- MCP tools are allowlisted/namespaced before exposure, and MCP failures are classified separately from provider failures.
- Built-in tool filesystem and bash safety semantics match the allowed-root contract.
- Provider integration uses a real local `codex-as-api` HTTP endpoint; tests that need a provider must be integration-gated, not mocked as behavior proof.
- Provider calls are non-streaming in v1; streaming parser work is deferred.
- Provider tests use the documented `codex-as-api` health and chat-completions contracts.
- Error responses include stack traces.
- Logs include `traceId`, span metadata, prompt/tool schema versions, and redacted context metadata.
- Final response completion claims are backed by same-turn successful tool events.
- No silent fallback to another model/provider.
- Existing gateway tests continue to pass.
- `POST /turn` remains supported and documented as the canonical v1 entrypoint.
- `POST /turn` accepts `message` only and rejects legacy transcript/audio fields.
- If `POST /agent/turn` exists, tests prove it is an alias to the same engine path rather than a divergent second contract.
- Automated tests prove `/turn` cannot call the legacy route-selection/fallback path.

## ADR

Decision: implement a small engine module inside `services/agent-gateway`.

Drivers:

- Minimal service count.
- Reuses existing server lifecycle.
- Keeps provider/tool/MCP abstractions testable.

Alternatives considered:

- Rewrite gateway as engine: rejected because it risks mixing intent router and agent loop.
- New service package: rejected as premature.
- Adopt Codex internals directly: rejected because the Rust core is not a small JS dependency and would overfit v1.

Consequences:

- `services/agent-gateway` becomes the host package for the new engine.
- Legacy route planning is deleted or moved to an internal-only comparison module that is unreachable from `/turn`.
- Future cleanup may rename the package or split `agent-engine` when stable.

Follow-ups:

- Replace codex-as-api with OpenRouter + EXAONE/FriendlyAI after testbed is proven.
- Add tool-evolution candidate schema and validator.
- Add permission/approval model before exposing write/bash to untrusted clients.

## Available Agent Types For Execution

- `executor`: implement engine modules and endpoint.
- `test-engineer`: build unit/integration tests with real temp filesystem and provider-gated tests.
- `architect`: review boundaries before provider swap.
- `code-reviewer`: review tool execution risk and logging completeness.
- `verifier`: run acceptance checks and inspect logs.

## Suggested Execution Staffing

- Default: `$ultragoal` for durable sequential implementation.
- Parallel option: `$ultragoal` leader plus `$team` with:
  - executor lane: engine/provider/tool registry modules
  - test-engineer lane: test harness and real filesystem tool tests
  - verifier lane: logging/error evidence checklist
- `$ralph` fallback: only if a single-owner persistent loop is explicitly preferred over ledger-style delivery.
