# Test Spec: Lightweight Agent Engine

## Test Philosophy

No mock implementation may be used as evidence that provider behavior works. Unit tests may use deterministic scripted model transports only for isolated parser/registry/loop mechanics, and must label them as non-provider contract tests. Tool execution tests must use real temporary files/commands. Provider tests must be gated integration tests against a real `codex-as-api` HTTP process.

## Required Test Layers

### Unit / Contract Tests

- `ToolRegistry` registers exactly `read`, `write`, `edit`, `bash` by default.
- Duplicate tool names are rejected with an explicit error.
- Tool definitions produce OpenAI-compatible function tool specs.
- Stable prompt assembly is deterministic and does not include turn id, current time, user id, provider health, or dynamic metadata.
- Provider request metadata includes `OBA_PROMPT_VERSION`, `OBA_TOOL_SCHEMA_VERSION`, and context block types without logging full prompt/body content.
- Tool call parser accepts valid tool calls and rejects malformed JSON with stackful errors.
- Duplicate provider tool call ids in one turn do not execute twice.
- Same provider tool call id with different normalized arguments produces an explicit conflict/error tool result.
- Agent loop stops when final assistant content is returned.
- Agent loop stops at max tool iterations with explicit `MAX_TOOL_ITERATIONS` error.
- Provider error, provider incomplete/refusal, tool error, and MCP error produce distinct error codes.

### Real Filesystem Tool Tests

Use `node:test` with `fs.mkdtemp` under the OS temp directory.

- `read` reads an existing UTF-8 file.
- `read` rejects paths outside allowed root.
- `read` rejects an inside-root symlink whose real target is outside the root.
- `write` creates a new file under allowed root.
- `write` rejects outside-root writes.
- `write` rejects writes through an outside-root symlink parent.
- `edit` applies a focused change and fails when the target text is absent.
- `edit` fails when one match is expected but multiple matches exist.
- `bash` executes a harmless command with cwd and timeout.
- `bash` rejects a cwd outside the allowed root.
- `bash` rejects a symlink cwd that resolves outside the allowed root.
- `bash` returns non-zero exit code and stderr without throwing away traceback/log metadata.
- `bash` timeout produces explicit timeout error.
- `bash` redacts configured secret-like environment values from logs.
- Tests must not assert that `bash` is an OS filesystem sandbox. V1 only proves initial cwd/root validation, timeout, environment shaping, redaction, and structured result/error behavior.

### Streamable HTTP MCP Adapter Contract Tests

- Tests use `@modelcontextprotocol/sdk@1.29.0` client imports, not the `@modelcontextprotocol/client@2.x` alpha packages.
- Adapter validates the documented config schema: server id, `streamable-http` transport, absolute URL, env-expanded headers, enabled tool allowlist, tool policies, and timeout cap.
- Missing environment variable references in headers fail initialization with stackful errors.
- Adapter maps streamable HTTP MCP tool metadata into the same registry shape as built-ins.
- MCP tool names are registered as `serverId.toolName` unless that namespacing is explicitly changed later.
- Name collision with a built-in or another registered tool fails startup.
- Adapter dispatch returns model-visible tool result payloads.
- MCP server init/discovery failure produces structured error logs.
- MCP tool failure includes server id, tool name, stack/cause.
- MCP failure is surfaced as a capability/tool failure, not as a provider failure.
- MCP tools without explicit policy default to `high-risk-write` and are not exposed.
- High-risk MCP write tools are either omitted by policy or wrapped by a local registry tool before exposure.

These can use a tiny local streamable HTTP MCP test server, but not a fake result pretending to be a real model/provider.

### Provider Integration Tests

Gated by environment variable, for example `OBA_RUN_CODEX_AS_API_TESTS=1`.

Preconditions:

- `codex-as-api` is already running at `OBA_PROVIDER_BASE_URL` or the documented default `http://127.0.0.1:18080/v1`.
- Codex OAuth credentials are available through `~/.codex/auth.json` or configured Codex auth path.

Assertions:

- `GET ${OBA_PROVIDER_HEALTH_URL}` returns `status: "ok"` and `auth_available: true`; if `OBA_PROVIDER_HEALTH_URL` is unset, derive it from `OBA_PROVIDER_BASE_URL` by replacing `/v1` with `/health`.
- If the health endpoint is missing or its shape changes, fail with `CODEX_AS_API_HEALTH_CONTRACT_CHANGED`; do not silently fall back to another readiness check.
- A minimal chat completion returns assistant content.
- The provider sends `model: OBA_PROVIDER_MODEL` on every request.
- The provider sends OpenAI-compatible `messages`, `tools`, and continuation tool-result messages to `${OBA_PROVIDER_BASE_URL}/chat/completions`.
- A tool-call request with provided tools returns either a real tool call or a final answer; if no tool call is returned, test must not claim tool loop success.
- Provider errors include response status, body preview, and stack.

### HTTP Endpoint Tests

- `GET /health` remains available.
- `POST /turn` validates missing message.
- `POST /turn` rejects legacy `turn.transcript`, `transcript`, and `audioText` fields with `VALIDATION_ERROR`.
- `POST /turn` accepts only a non-empty string `message` as the user turn text.
- `POST /turn` with `toolMode: "disabled"` sends no tools to the provider.
- `POST /turn` returns stackful error when provider is unavailable.
- If `POST /agent/turn` exists, it delegates to the same handler and has parity tests with `/turn`.
- Endpoint tests can run deterministic tool-loop contracts using a scripted model transport only for engine loop mechanics, labeled as non-provider tests.
- A regression test proves `/turn` does not invoke the legacy route selector or legacy fallback order.
- V1 endpoint tests assert non-streaming provider calls; streaming parser behavior is outside v1.

## Observability Checks

Capture stderr/stdout during tests or expose a test logger sink.

Required events:

- `turn.start`
- `provider.request`
- `provider.response` or `provider.error`
- `tool.call.duplicate` when a duplicate call id is observed
- `tool.call.start`
- `tool.call.success` or `tool.call.error`
- `final.claim_check`
- `turn.complete` or `turn.error`

Required error fields:

- `turnId`
- `traceId`
- `spanId`
- `parentSpanId`, when relevant
- `name`
- `message`
- `stack`
- `cause`, when available
- `toolName` or `providerName`, when relevant
- `promptVersion`
- `toolSchemaVersion`

Logs must redact:

- authorization headers
- provider request bodies
- full prompt text
- raw user message beyond short sanitized preview or hash
- configured secret-like environment values

### Final Claim Checks

- If a final answer claims a file was read, written, edited, or a command was run, the test must verify a successful same-turn tool event exists.
- If a final answer claims an MCP action completed, the test must verify a successful same-turn MCP-backed tool event exists.
- If the provider final answer claims completion without evidence, the response policy must downgrade the claim or return an explicit uncertainty/failure result.

## Regression Tests

- Existing `npm test` suite must continue to pass.
- Existing gateway health and non-engine tests must remain green.
- Legacy gateway route migration is outside this plan's acceptance scope and must not be reachable from `/turn`.

## Manual Verification

1. Start `codex-as-api` locally.
2. Start OBA gateway with the Codex testbed provider.
3. Submit a `/turn` request requiring `read` against a temporary fixture file.
4. Confirm logs show provider request, tool call, tool result, and final answer.
5. Stop `codex-as-api`.
6. Submit another turn and confirm there is no fallback and the response includes traceback.

## Exit Criteria

- All ungated unit/contract/filesystem tests pass through `npm test`.
- Gated provider test passes in a local Codex OAuth environment.
- Manual verification log transcript is captured in implementation notes.
- No release docs describe `codex-as-api` as production dependency.
- Implementation notes explicitly list deferred guide concepts: streaming parser, persistent session offload, compaction/replay, evaluator pipeline, and user-level provider auth storage.
