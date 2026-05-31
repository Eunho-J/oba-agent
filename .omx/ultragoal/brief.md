# Ralplan Consensus Handoff: Lightweight Agent Engine

## Status

- `ralplan_consensus_gate.complete`: true
- Sequence: Architect review -> Critic review
- Result: approved for implementation planning handoff
- Scope: planning only; no engine implementation edits were made in this ralplan pass.

## Planning Artifacts

- Context: `.omx/context/agent-engine-20260530T114258Z.md`
- PRD: `.omx/plans/prd-agent-engine-20260530T114258Z.md`
- Test spec: `.omx/plans/test-spec-agent-engine-20260530T114258Z.md`

## Final Architecture Decision

Implement a small engine module inside `services/agent-gateway`.

The public v1 endpoint is `POST /turn`. It replaces the legacy route-selection/fallback behavior. Optional `POST /agent/turn` may exist only as an internal/test alias to the same handler.

V1 provider is a local OpenAI-compatible HTTP `codex-as-api` testbed:

- external local process, not an imported auth implementation
- `OBA_PROVIDER_BASE_URL` default: `http://127.0.0.1:18080/v1`
- `OBA_PROVIDER_MODEL` default: `gpt-5.5`
- every provider request includes `model: OBA_PROVIDER_MODEL`
- health URL derives from the configured base URL unless `OBA_PROVIDER_HEALTH_URL` is set
- no silent fallback to another provider

MCP v1 is streamable HTTP only:

- dependency: `@modelcontextprotocol/sdk@1.29.0`
- no `@modelcontextprotocol/client@2.x` alpha packages in v1
- tools are registered as registry entries, preferably `serverId.toolName`

Built-in tools are exactly:

- `read`
- `write`
- `edit`
- `bash`

Tools are represented as evolvable artifacts with metadata, schema, risk, executor reference, version, and provenance, but self-evolution is deferred beyond v1.

## Required Verification

- Unit/contract tests for registry, tool schema, tool-call parsing, and loop termination.
- Real filesystem tests for `read`, `write`, `edit`, and `bash`, including symlink escape and timeout behavior.
- Streamable HTTP MCP adapter tests against a local test server.
- Provider integration tests gated by `OBA_RUN_CODEX_AS_API_TESTS=1` against real local `codex-as-api`.
- HTTP tests proving `/turn` rejects legacy transcript/audio fields and cannot invoke the legacy route selector.
- Observability checks for structured logs and stackful errors.

## Final Architect Review

Verdict: APPROVE.

The Architect approved after the plan pinned MCP to `@modelcontextprotocol/sdk@1.29.0`, made the `codex-as-api` contract executable, bounded tool safety semantics, and clarified that `/turn` is message-only with legacy fields rejected.

Residual non-blocking risks:

- provider verification depends on a running `codex-as-api` process and Codex OAuth credentials
- `bash` is intentionally a trusted local command runner, not a full sandbox
- stdio MCP remains deferred

## Final Critic Review

Verdict: APPROVE.

The Critic approved because the plan is actionable, replaces `/turn` cleanly, rejects legacy transcript/audio fields, pins MCP and provider contracts, preserves future OpenRouter/EXAONE migration, and defines tests that are not smoke-only.

Residual non-blocking risks:

- `codex-as-api` is third-party and may drift
- current docs still mention older `audioText`/OpenRouter flow and must be updated during implementation
- `bash` must remain private/local until a stronger approval or sandbox model exists

## Suggested Execution Lane

Use `$ultragoal` or a direct implementation pass with this handoff as the acceptance contract. If parallelizing, split work into:

- engine/provider loop
- built-in tools and safety tests
- MCP adapter and config tests
- HTTP endpoint migration and docs
- verification/logging pass

## Post-Guide Review Addendum

Reference reviewed: `/Users/cayde/Desktop/chat-agent-guide.md`.

Accepted into the v1 plan:

- stable prefix and dynamic turn context are separated
- prompt/tool schema versions are logged as metadata
- v1 provider calls are explicitly non-streaming
- provider, tool, MCP, and validation failures remain distinct
- same-turn tool execution records back final completion claims
- duplicate provider tool call ids do not trigger duplicate execution
- trace/span metadata connects turn, provider, tool, MCP, and final response events
- MCP tools require allowlist/namespacing/risk gates before exposure

Intentionally deferred:

- provider streaming parser and delta accumulator
- persistent session database/offload
- context compaction and replay
- evaluator pipeline and quality records
- user-level provider OAuth/token storage
- full transactional idempotency state machine

Reasoning:

The guide describes a mature long-running work-agent runtime. OBA v1 is a private, lightweight engine testbed, so the plan adopts safety boundaries that prevent false success and debugging blindness while keeping persistence, streaming, and evaluation subsystems out of the first implementation.
