# Profiled Direct Engine, EXAONE Routing, Compaction, Voice, And Pretext UI Plan

## TL;DR
> **Summary**: Build one reusable direct OBA engine and run it with static code/env capability profiles. `main-agent` enables tools/MCP/ggui/reasoning behavior; `exaone-agent` reuses the same engine but disables tools/MCP and uses the emotional model route, defaulting to LM Studio + `exaone-4.0-1.2b`. Codex app-server remains only a separate implementer/self-improvement executor, never `/turn` runtime.
> **Deliverables**:
> - One profiled direct engine, not separate main/EXAONE engine implementations
> - Code/env capability profile registry for tools, MCP, ggui, memory, compaction, hooks, and self-improvement
> - Codex CLI source parity checklist for turn/session/context/resource behavior
> - Durable conversation memory with token accounting and compaction at `0.9` of model context
> - Cancellation, timeout, cleanup, and shutdown lifecycle management
> - Configurable emotional model routing, defaulting to LM Studio + EXAONE
> - Codex-as-implementer self-improvement lane with skill/hook/system-prompt evolution
> - Inline dynamic ggui, browser microphone Voice, and Pretext-backed responsive UI
> **Effort**: XL
> **Parallel**: YES - 5 waves
> **Critical Path**: Codex parity map -> profile registry -> memory/compaction/resource lifecycle -> shared engine orchestration -> UI/voice/e2e

## Context
### Original And Updated Requests
- "메인 에이전트와 감성/EXAONE 에이전트는 둘 다 직접 구현 엔진"
- "이건 동일한 엔진을 재사용하되, exaone 에이전트는 툴콜과 mcp를 제외"
- "기능 요소를 탈부착이 가능한 형태로 구현해야해. (에이전트가 탈부착을 한다는건 아니고, 코드/환경설정 단에서.)"
- "엔진 기능은 자기개선 요소들이 필수적으로 요구되고, context 관리, compaction 등이 제대로 수행되어야해."
- "compaction threshold는 0.9(최대치의 90프로) 로 잡고."
- "엔진 구현체는 각 기능 단위별로 codex cli 깃허브 소스코드 기준으로, 빠진 부분이 있으면 안돼. 자원관리 쪽 디테일도 신경 써야해."
- Earlier standing constraints: EXAONE is the model name, default is LM Studio + `exaone-4.0-1.2b`; model connection must be swappable; Voice is microphone button capture; ggui attaches inside the answer bubble; UI must be responsive and use `@chenglou/pretext` where appropriate; Browser plugin only, no standalone Playwright.

### Clarified Architecture
- Runtime shape: one reusable direct engine entrypoint with explicit profile input.
- `main-agent` profile: tools enabled, MCP enabled, ggui enabled, reasoning memory enabled, self-improvement signal collection enabled.
- `exaone-agent` profile: same engine entrypoint, tools disabled, MCP disabled, ggui render execution disabled, expression memory enabled, emotional model route enabled.
- Profiles are controlled by source/config/env, not by model self-selection during a turn.
- Codex app-server is not used for user-facing runtime. It can be invoked only as an isolated implementer for self-improvement work.
- Target implementation is the active `oba-agent/services/agent-gateway` app; `oba-agent-light` is a reference for reusable runtime/profile ideas, not the product entrypoint.

### Research Findings
- Current gateway `/turn` uses `runAgentTurn()` for main behavior, then `finalizeAgentTurnWithExaone()` calls LM Studio separately.
- Current gateway has `toolMode: "disabled"` coverage, but no first-class profile registry, no shared main/EXAONE engine profile, and no durable compaction.
- `oba-agent-light` already has a reusable direct engine seed and `toolMode`, plus prompt/skill/hook patterns, but no EXAONE profile, no ggui, and no persisted conversation compaction.
- Official `openai/codex` HEAD is `966932124c243aab71719c269d79305844f35814`; `chenglou/pretext` HEAD is `796b4691ca782ec44df9eb5d470abeca4d25732f`.
- Codex CLI source shows runtime features to mirror functionally: configurable compaction limit/scope, mid-turn compaction, per-turn cancellation tokens, MCP/tool feature gating, MCP allow/deny filtering, connection cancellation/re-init, and shutdown lifecycle checks.

### Metis Review
- Replaced "two direct engines" with "one direct engine plus profiles".
- Removed model-decided capability changes; capability attachment is profile/config-driven.
- Added a blocking Codex parity audit task for runtime behavior, not only auth.
- Added explicit tokenizer/max-context/compaction threshold decisions.
- Added resource lifecycle management: cancellation, timeout, cleanup, and shutdown.
- Added per-conversation concurrency and memory-store corruption safeguards.

## Work Objectives
### Core Objective
Implement OBA as a profiled direct-engine system where main and EXAONE reuse the same engine implementation. Behavioral differences must come from validated capability profiles and provider/model routing, while context, compaction, lifecycle, and self-improvement infrastructure remain shared engine responsibilities.

### Deliverables
- `CodexRuntimeParityMatrix` mapping official Codex CLI functional units to OBA direct-engine equivalents.
- `AgentProfileRegistry` with `main-agent` and `exaone-agent` profiles.
- Shared `runProfiledAgentTurn()` or equivalent entrypoint used by both profiles.
- `ConversationMemoryStore` with per-conversation files, manifest/journal, locks, redaction, token accounting, and compaction.
- `ContextCompactor` with threshold `0.9`, pre-turn and mid-turn checks, deterministic summaries, and replay ordering.
- `TurnResourceManager` for per-turn cancellation, timeouts, child-process cleanup, MCP client cleanup, provider aborts, and shutdown.
- Capability modules for tools, MCP, ggui, hooks, skills, memory recall, provider routing, and debug trace.
- Emotional model router defaulting to LM Studio + `exaone-4.0-1.2b`, with swappable config.
- Internal Codex implementer lane for self-improvement of skills, hooks, workflows, and both agents' system prompts.
- Browser microphone Voice flow via whisper.cpp.
- Pretext-backed compact responsive chat UI with inline ggui answer components.

### Definition of Done
- `node --test services/agent-gateway/test/*.test.js services/agent-gateway/test/*.test.mjs` passes.
- `npm --prefix apps/client run check` passes.
- `npx expo export --platform web --output-dir /tmp/oba-client-web-profiled-engine` passes.
- Codex parity matrix has pass/fail evidence for every in-scope runtime feature.
- Browser plugin E2E proves:
  - One shared engine entrypoint runs both `main-agent` and `exaone-agent` profiles.
  - `main-agent` receives tool/MCP/ggui capabilities.
  - `exaone-agent` receives no tool specs, no MCP tools, and cannot execute side effects.
  - Context continuity works across turns.
  - Compaction triggers at `0.9` of configured max context.
  - Turn cancellation and cleanup do not leak resources.
  - EXAONE final response uses LM Studio + `exaone-4.0-1.2b` by default.
  - Model connection can be switched without code edits.
  - ggui surfaces render inline inside the assistant answer bubble.
  - Voice records microphone audio and places transcript into the input.
  - UI is compact and responsive at mobile/tablet/desktop sizes.

### Must Have
- Exactly one direct engine implementation reused by both profiles.
- Static capability profiles selected by code/config/env, never by the model deciding to attach its own capabilities.
- Required profiles:
  - `main-agent`: `tools=true`, `mcp=true`, `ggui=true`, `memory=reasoning`, `selfImprovementSignals=true`.
  - `exaone-agent`: `tools=false`, `mcp=false`, `ggui=false` for execution, `memory=expression`, `provider=emotionalModelRouter`.
- Provider-neutral emotional model config:
  - `OBA_EMOTIONAL_MODEL_PROVIDER=lmstudio`
  - `OBA_EMOTIONAL_MODEL_BASE_URL=http://127.0.0.1:1234/v1`
  - `OBA_EMOTIONAL_MODEL_NAME=exaone-4.0-1.2b`
  - `OBA_EMOTIONAL_MODEL_API_KEY=lm-studio`
  - `OBA_EMOTIONAL_MODEL_TIMEOUT_MS`
- Context compaction config:
  - `OBA_CONTEXT_COMPACTION_THRESHOLD=0.9`
  - `OBA_CONTEXT_WINDOW_TOKENS` or model/provider-derived max context
  - pre-turn check and mid-turn check
  - deterministic summary schema and replay order
- Resource management config:
  - per-turn cancellation token/abort controller
  - provider timeout
  - tool timeout
  - MCP discovery/execution timeout
  - whisper upload/transcription timeout
  - shutdown cleanup
- Self-improvement capabilities are core engine modules: skill evolution, hook evolution, workflow/node spec evolution, system prompt evolution for both profiles, and improvement evidence capture.
- Hook failures must be diagnostic evidence and must not crash `/turn`.
- Codex CLI source parity must be checked feature-by-feature against official pinned source.
- Browser-facing QA uses Browser plugin, not standalone Playwright.

### Must NOT Have
- No Codex app-server as main or EXAONE runtime.
- No duplicate engine implementations for main and EXAONE.
- No agent-decided capability attachment/detachment.
- No emotional profile tool specs, MCP tools, shell/file permissions, app/plugin tools, or approvals in provider requests.
- No hard-coded EXAONE-only route that prevents model switching.
- No user-visible upload picker for Voice.
- No restaurant/search-specific ggui design.
- No raw credential copying or direct parsing of `$CODEX_HOME/auth.json`.
- No unbounded context replay.
- No standalone Playwright.

## Official References
- Codex compaction token status and threshold behavior: [openai/codex `turn.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/turn.rs#L659-L708).
- Codex compaction config fields: [openai/codex `config/mod.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/config/mod.rs#L563-L571).
- Codex mid-turn compaction branch: [openai/codex `turn.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/turn.rs#L264-L299).
- Codex active-turn cancellation token: [openai/codex `session/mod.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/mod.rs#L1847-L1855).
- Codex MCP connection re-init/cancellation: [openai/codex `session.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/session.rs#L1135-L1196).
- Codex feature-gated apps/MCP/tool discovery: [openai/codex `config/mod.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/config/mod.rs#L1333-L1359), [openai/codex `turn.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/turn.rs#L480-L509).
- Codex MCP allow/deny tool config: [openai/codex `mcp_types.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/config/src/mcp_types.rs#L165-L175).
- Codex shutdown lifecycle tests: [openai/codex `session/tests.rs`, commit `9669321`](https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/tests.rs#L5937-L5979).
- Pretext package and layout APIs: [`@chenglou/pretext`, commit `796b469`](https://github.com/chenglou/pretext/blob/796b4691ca782ec44df9eb5d470abeca4d25732f/package.json#L1), [layout API](https://github.com/chenglou/pretext/blob/796b4691ca782ec44df9eb5d470abeca4d25732f/src/layout.ts#L682), [rich inline API](https://github.com/chenglou/pretext/blob/796b4691ca782ec44df9eb5d470abeca4d25732f/src/rich-inline.ts#L158).

## Verification Strategy
> ZERO HUMAN INTERVENTION except browser microphone permission handling through Browser-plugin-controlled media where available.
- Test decision: TDD with Node `node:test`; write failing tests first for profile gating, compaction, resource cleanup, and model routing.
- QA policy: Every task has happy and failure scenarios.
- Browser QA: Browser plugin only.
- Evidence path: `evidence/profiled-direct-engine/task-{N}-{slug}.md` and Browser screenshots.

## Execution Strategy
### Parallel Execution Waves
- Wave 1: Codex parity matrix, profile schema, memory/compaction design tests, resource manager tests.
- Wave 2: Shared engine entrypoint, capability module gating, emotional model router, context replay.
- Wave 3: Self-improvement modules, hook safety, ggui inline contract, Voice recorder.
- Wave 4: Pretext responsive UI, docs/config migration, real LM Studio/whisper checks.
- Wave 5: Browser E2E, parity audit, final review.

### Dependency Matrix
- Task 1 blocks Tasks 2, 3, 4, 5, 6, 7, 8, 13.
- Task 2 blocks Tasks 5, 6, 7, 8, 10, 13.
- Task 3 blocks Tasks 6, 7, 13.
- Task 4 blocks Tasks 5, 6, 7, 8, 11, 13.
- Task 5 blocks Tasks 6, 7, 10, 13.
- Task 6 blocks Tasks 7, 13.
- Task 7 blocks Tasks 10, 13.
- Task 8 blocks Tasks 9, 13.
- Task 9 blocks Task 13.
- Task 10 blocks Tasks 12, 13.
- Task 11 blocks Task 13.
- Task 12 blocks Task 13.
- Task 13 blocks Final Verification.

## TODOs
- [ ] 1. Codex CLI Runtime Parity Matrix

  **What to do**: Create a source-pinned parity matrix that maps official Codex CLI runtime behavior to OBA direct-engine modules. Cover context/compaction, turn lifecycle, cancellation, provider aborts, MCP/tool feature gates, MCP allow/deny, approval/sandbox-equivalent denial policy, hook/self-improvement surfaces, persistence, and shutdown. This task produces executable tests or explicit out-of-scope justifications for every row.
  **Must NOT do**: Do not use Codex app-server as runtime. Do not leave a parity row as "later" without a failure test or documented scope exclusion.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2,3,4,5,6,7,8,13 | Blocked By: none

  **References**:
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/turn.rs#L659-L708` - compaction threshold/status behavior.
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/mod.rs#L1847-L1855` - per-turn cancellation token.
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/session.rs#L1135-L1196` - MCP runtime cancellation/re-init.
  - Pattern: `/Users/cayde/Workspace/oppa/oba-agent-light/src/runtime.js` - reusable runtime composition reference.
  - Pattern: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/engine/agent.js` - current gateway engine to migrate.

  **Acceptance Criteria**:
  - [ ] `docs/codex-runtime-parity.md` lists every in-scope Codex runtime feature and OBA equivalent.
  - [ ] Each parity row links a test file, implementation target, or explicit out-of-scope reason.
  - [ ] Source scan proves no row says "TODO" or "unknown".

  **QA Scenarios**:
  ```text
  Scenario: Parity matrix completeness
    Tool: bash
    Steps: Run `rg -n "TODO|unknown|later" docs/codex-runtime-parity.md`.
    Expected: No matches.
    Evidence: evidence/profiled-direct-engine/task-1-parity.md

  Scenario: Official source link validity
    Tool: bash
    Steps: Run a link-check script or curl each pinned GitHub URL in the matrix.
    Expected: Every referenced official source URL returns success.
    Evidence: evidence/profiled-direct-engine/task-1-links.md
  ```

  **Commit**: YES | Message: `docs(engine): add codex runtime parity matrix` | Files: `docs/codex-runtime-parity.md`, `services/agent-gateway/test/*`

- [ ] 2. Agent Profile Registry

  **What to do**: Add a validated profile registry for `main-agent` and `exaone-agent`. Profiles define provider route, system prompt id, memory lane, tool capability, MCP capability, ggui execution capability, self-improvement signal capture, compaction policy, and debug redaction policy. Selection is server-side only; user requests cannot override profile capabilities.
  **Must NOT do**: Do not allow model output to enable/disable capabilities. Do not duplicate engine code per profile.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5,6,7,8,10,13 | Blocked By: 1

  **References**:
  - Pattern: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/engine/agent.js:13` - current `toolMode` seed.
  - Pattern: `/Users/cayde/Workspace/oppa/oba-agent-light/src/prompts/registry.js` - profile/prompt registry reference.
  - Test: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/test/engine.test.js:187` - existing disabled tool behavior.

  **Acceptance Criteria**:
  - [ ] `main-agent` profile exposes tools/MCP/ggui.
  - [ ] `exaone-agent` profile exposes no tools and no MCP.
  - [ ] Invalid profile config fails server startup with typed error.
  - [ ] Client `/turn` cannot request an unsafe EXAONE profile.

  **QA Scenarios**:
  ```text
  Scenario: Main profile capabilities
    Tool: bash
    Steps: Run profile unit test for `main-agent`.
    Expected: tools=true, mcp=true, ggui=true, memory=reasoning.
    Evidence: evidence/profiled-direct-engine/task-2-main-profile.md

  Scenario: EXAONE profile cannot receive tools
    Tool: bash
    Steps: Attempt to override `exaone-agent.tools=true` via request payload.
    Expected: Request override ignored or rejected; provider receives no tool specs.
    Evidence: evidence/profiled-direct-engine/task-2-exaone-deny.md
  ```

  **Commit**: YES | Message: `feat(engine): add static agent capability profiles` | Files: `services/agent-gateway/src/engine/*`, `services/agent-gateway/test/engine-profile.test.js`

- [ ] 3. Conversation Memory, Token Accounting, And Compaction

  **What to do**: Implement durable context memory with per-conversation files plus manifest/journal and per-conversation locking. Add token estimation/counting, max-context resolution, and compaction at `OBA_CONTEXT_COMPACTION_THRESHOLD=0.9`. Run pre-turn and mid-turn checks. Preserve replay order: stable system/prompt prefix -> compacted memory summary -> recent raw turns -> current user message -> tool summaries.
  **Must NOT do**: Do not use a single global `active.json` for all conversations. Do not replay unbounded raw history. Do not compact below the stable profile/system prompt.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6,7,13 | Blocked By: 1

  **References**:
  - Current stateless prompt: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/engine/agent.js:30`
  - Current `conversationId`: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/index.js:65`
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/turn.rs#L659-L708` - compaction status calculation.
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/turn.rs#L264-L299` - mid-turn compaction trigger.

  **Acceptance Criteria**:
  - [ ] Same `conversationId` replays prior context into both profiles.
  - [ ] Compaction triggers when estimated tokens reach `floor(maxContext * 0.9)`.
  - [ ] Mid-turn compaction can run before follow-up provider call.
  - [ ] Different conversations do not leak memory.
  - [ ] Corrupt conversation file fails safely and does not overwrite valid data.

  **QA Scenarios**:
  ```text
  Scenario: 90 percent compaction
    Tool: bash
    Steps: Configure `OBA_CONTEXT_WINDOW_TOKENS=1000`, send turns totaling 901 estimated tokens.
    Expected: Compactor runs and writes deterministic summary before next provider call.
    Evidence: evidence/profiled-direct-engine/task-3-compaction.md

  Scenario: Concurrent same-conversation turns
    Tool: bash
    Steps: Send two simultaneous `/turn` requests with the same conversationId.
    Expected: Per-conversation lock serializes writes; no corrupted memory file.
    Evidence: evidence/profiled-direct-engine/task-3-concurrency.md
  ```

  **Commit**: YES | Message: `feat(engine): add conversation memory and compaction` | Files: `services/agent-gateway/src/engine/*`, `services/agent-gateway/test/context-compaction.test.js`

- [ ] 4. Turn Resource Manager

  **What to do**: Add per-turn resource management matching Codex CLI functional behavior: active turn id, abort controller, child cancellation tokens, provider request timeout, tool timeout, MCP discovery/execution timeout, whisper transcription timeout, temp-file cleanup, and shutdown hooks. All long-running work must accept a signal or be wrapped with deterministic teardown.
  **Must NOT do**: Do not leave orphaned provider requests, MCP clients, child processes, temp audio files, or timers after cancellation/shutdown.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5,6,7,8,11,13 | Blocked By: 1

  **References**:
  - Current EXAONE timeout signal: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/clients/exaone.js:203`
  - Current bash timeout: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/tools/builtins.js:113`
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/mod.rs#L1847-L1855` - active turn cancellation.
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/tests.rs#L5937-L5979` - shutdown lifecycle expectations.

  **Acceptance Criteria**:
  - [ ] Cancelled `/turn` aborts provider calls and tool execution.
  - [ ] Gateway shutdown closes MCP clients and prevents new memory writes.
  - [ ] Timers are cleared after successful, failed, and cancelled turns.
  - [ ] Voice temp files are removed after transcription failure.

  **QA Scenarios**:
  ```text
  Scenario: Provider cancellation
    Tool: bash
    Steps: Start fake provider that never responds; cancel request.
    Expected: Provider abort signal fires and turn resource report has zero active timers.
    Evidence: evidence/profiled-direct-engine/task-4-provider-cancel.md

  Scenario: Shutdown cleanup
    Tool: bash
    Steps: Start gateway, begin MCP discovery, invoke shutdown.
    Expected: MCP clients close, memory writer stops, no unhandled rejection.
    Evidence: evidence/profiled-direct-engine/task-4-shutdown.md
  ```

  **Commit**: YES | Message: `feat(engine): manage turn resources and cancellation` | Files: `services/agent-gateway/src/engine/*`, `services/agent-gateway/test/resource-manager.test.js`

- [ ] 5. Capability Modules: Tools, MCP, And ggui Gating

  **What to do**: Convert tools, MCP, and ggui into capability modules attached by profile at engine construction. Main profile registers built-in tools, discovered MCP tools, and ggui renderer tools. EXAONE profile receives none of those specs and blocks any tool-call-like model output before execution.
  **Must NOT do**: Do not merely reject EXAONE tool calls after exposing tools. Do not discover MCP for EXAONE turns.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 6,7,10,13 | Blocked By: 1,2,4

  **References**:
  - Current tool specs: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/tools/registry.js:4`
  - Current MCP adapter: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/mcp/adapter.js:7`
  - Current ggui attachment path: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/engine/agent.js:200`
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/config/src/mcp_types.rs#L165-L175` - MCP allow/deny filtering.

  **Acceptance Criteria**:
  - [ ] Main profile provider request includes allowed tools and MCP tools.
  - [ ] EXAONE profile provider request includes no tool specs.
  - [ ] MCP discovery does not run for EXAONE profile.
  - [ ] Tool allow/deny policy is tested at profile and MCP-server level.

  **QA Scenarios**:
  ```text
  Scenario: Main profile MCP discovery
    Tool: bash
    Steps: Fake MCP server exposes `search`; POST `/turn` with normal main flow.
    Expected: Main provider receives `search` tool spec.
    Evidence: evidence/profiled-direct-engine/task-5-main-mcp.md

  Scenario: EXAONE profile side-effect denial
    Tool: bash
    Steps: Fake emotional model returns tool_calls.
    Expected: No tool execution; debug records `PROFILE_TOOL_CALL_BLOCKED`.
    Evidence: evidence/profiled-direct-engine/task-5-exaone-block.md
  ```

  **Commit**: YES | Message: `feat(engine): gate tools mcp and ggui by profile` | Files: `services/agent-gateway/src/engine/*`, `services/agent-gateway/src/mcp/*`, `services/agent-gateway/test/profile-capabilities.test.js`

- [ ] 6. Shared Profiled Engine Entry Point

  **What to do**: Refactor the current turn loop into one shared engine entrypoint that accepts `profileId`, context envelope, resource manager, memory manager, capability modules, provider route, and debug collector. Both main and EXAONE must call this same entrypoint. Split oversized modules during the refactor so files stay maintainable.
  **Must NOT do**: Do not create a separate `runExaoneTurn()` engine loop that duplicates main engine logic. Do not hide profile behavior in ad hoc conditionals scattered across HTTP code.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 7,13 | Blocked By: 1,2,3,4,5

  **References**:
  - Current gateway engine: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/engine/agent.js:10`
  - Current HTTP orchestration: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/index.js:61`
  - Reference direct runtime: `/Users/cayde/Workspace/oppa/oba-agent-light/src/engine/agent.js:75`
  - Reference composition: `/Users/cayde/Workspace/oppa/oba-agent-light/src/runtime.js:133`

  **Acceptance Criteria**:
  - [ ] Test proves both profiles call the same engine function/module.
  - [ ] `/turn` orchestration no longer has separate main-loop and EXAONE-loop logic.
  - [ ] Engine debug shows `profileId`, capability set, resource ids, and context revision.
  - [ ] No touched source module exceeds the established maintainability limit without documented split.

  **QA Scenarios**:
  ```text
  Scenario: Same engine function for both profiles
    Tool: bash
    Steps: Instrument fake engine dependency and POST `/turn`.
    Expected: Calls are recorded as `runProfiledAgentTurn(main-agent)` then `runProfiledAgentTurn(exaone-agent)`.
    Evidence: evidence/profiled-direct-engine/task-6-shared-entry.md

  Scenario: Profile validation failure
    Tool: bash
    Steps: Configure missing provider route for `exaone-agent`.
    Expected: Typed startup/config error; server does not start in partial state.
    Evidence: evidence/profiled-direct-engine/task-6-profile-error.md
  ```

  **Commit**: YES | Message: `feat(engine): share one profiled turn engine` | Files: `services/agent-gateway/src/engine/*`, `services/agent-gateway/src/index.js`, `services/agent-gateway/test/http.test.js`

- [ ] 7. Orchestrated Main-To-EXAONE Flow And Model Router

  **What to do**: Implement static `/turn` orchestration: main profile runs first, then EXAONE profile runs through the same engine using the emotional model router. Default route is LM Studio + `exaone-4.0-1.2b`. Optional feedback cycle is controlled only by config, capped at one extra main pass, and never changes EXAONE capabilities.
  **Must NOT do**: Do not let EXAONE call tools. Do not let the model decide to attach capabilities. Do not hard-code LM Studio so other providers cannot be registered.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 10,13 | Blocked By: 1,2,3,5,6

  **References**:
  - Current LM Studio defaults: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/clients/exaone.js:21`
  - Current finalizer: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/index.js:295`
  - Current finalizer tests: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/test/http.test.js:116`

  **Acceptance Criteria**:
  - [ ] Default emotional route sends model `exaone-4.0-1.2b`.
  - [ ] Changing `OBA_EMOTIONAL_MODEL_NAME` changes outbound request model.
  - [ ] Main and EXAONE debug inputs both include context revision.
  - [ ] Optional feedback cycle is capped and config-controlled.

  **QA Scenarios**:
  ```text
  Scenario: Default EXAONE route
    Tool: bash
    Steps: Start fake LM Studio server; POST `/turn`.
    Expected: Fake server receives `exaone-4.0-1.2b`; final answer comes from EXAONE profile.
    Evidence: evidence/profiled-direct-engine/task-7-default-exaone.md

  Scenario: Feedback cap
    Tool: bash
    Steps: Enable one feedback cycle and make main request another cycle.
    Expected: Only one extra main pass occurs; debug shows cap reached.
    Evidence: evidence/profiled-direct-engine/task-7-feedback-cap.md
  ```

  **Commit**: YES | Message: `feat(agent): orchestrate profiled main and exaone turns` | Files: `services/agent-gateway/src/engine/*`, `services/agent-gateway/src/clients/*`, `services/agent-gateway/test/http.test.js`

- [ ] 8. Self-Improvement Engine Modules

  **What to do**: Make self-improvement a first-class engine subsystem: improvement signals, candidate staging, skill evolution, hook evolution, workflow/node spec evolution, and system prompt evolution for both profiles. Codex CLI/app-server can be used only as an isolated implementer for these jobs, with sanitized high-level instructions and no code-level patch bias.
  **Must NOT do**: Do not expose self-improvement UI in normal chat. Do not let runtime model directly edit code, hooks, skills, or prompts.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 9,13 | Blocked By: 1,2,4

  **References**:
  - Current staging code: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/self-improvement.js`
  - Existing tests: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/test/http.test.js:646`
  - Reference prompt registry: `/Users/cayde/Workspace/oppa/oba-agent-light/src/prompts/registry.js`
  - Official Codex CLI auth docs: `https://developers.openai.com/codex/cli`

  **Acceptance Criteria**:
  - [ ] Self-improvement subsystem is loaded as an engine capability.
  - [ ] Improvement jobs use sanitized high-level goals only.
  - [ ] Main and EXAONE system prompts are versioned improvement targets.
  - [ ] `/turn` works when Codex implementer is disabled or unauthenticated.

  **QA Scenarios**:
  ```text
  Scenario: Runtime independent from implementer
    Tool: bash
    Steps: Disable Codex implementer and POST `/turn`.
    Expected: Main + EXAONE runtime succeeds.
    Evidence: evidence/profiled-direct-engine/task-8-implementer-independent.md

  Scenario: Prompt candidate staged
    Tool: bash
    Steps: Run fake improvement job for `exaone-agent` prompt.
    Expected: Versioned candidate with rationale and rollback metadata is staged.
    Evidence: evidence/profiled-direct-engine/task-8-prompt-candidate.md
  ```

  **Commit**: YES | Message: `feat(engine): add self improvement capability modules` | Files: `services/agent-gateway/src/self-improvement.js`, `services/agent-gateway/src/engine/*`, `services/agent-gateway/test/self-improvement.test.js`

- [ ] 9. Hook Failure Diagnostics And Evolution Safety

  **What to do**: Wrap hooks so failures become structured diagnostic evidence for self-improvement. Add hook timeout, output size limit, redaction, and rollback metadata. Broken hooks must never crash `/turn` or block the active user-facing engine.
  **Must NOT do**: Do not run hooks without timeout. Do not auto-apply hook changes without versioned staging and rollback.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 13 | Blocked By: 8

  **References**:
  - Existing workflow hook proposal validation: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/workflows/candidate-node-handlers.js:72`
  - Existing hook candidate tests: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/test/workflow-evolution-candidates.test.js:27`
  - Existing architecture note: `/Users/cayde/Workspace/oppa/oba-agent/docs/architecture.md:111`

  **Acceptance Criteria**:
  - [ ] Throwing hook records diagnostic evidence and `/turn` still completes.
  - [ ] Hook proposal with non-diagnostic failure policy is rejected.
  - [ ] Hook execution respects timeout and output size limits.

  **QA Scenarios**:
  ```text
  Scenario: Hook throws during turn
    Tool: bash
    Steps: Register test hook that throws before provider call; POST `/turn`.
    Expected: Turn completes; diagnostic evidence records hook error.
    Evidence: evidence/profiled-direct-engine/task-9-hook-throws.md

  Scenario: Hook timeout
    Tool: bash
    Steps: Register test hook that sleeps past timeout.
    Expected: Hook is cancelled and diagnostic evidence is recorded.
    Evidence: evidence/profiled-direct-engine/task-9-hook-timeout.md
  ```

  **Commit**: YES | Message: `feat(engine): make hooks failure tolerant` | Files: `services/agent-gateway/src/engine/*`, `services/agent-gateway/src/workflows/*`, `services/agent-gateway/test/hook-safety.test.js`

- [ ] 10. Dynamic ggui Inline Attachment Contract

  **What to do**: Generalize ggui as a profile-gated answer attachment capability. Main profile may generate one or more sanitized UI surfaces; EXAONE profile may reference/describe surfaces but cannot execute ggui tools. Client renders surfaces inline inside the assistant answer bubble with loading/error/provenance states.
  **Must NOT do**: Do not render generated UI in a separate bottom panel. Do not keep restaurant/search-specific naming.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12,13 | Blocked By: 2,5,7

  **References**:
  - Current first attached surface path: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/index.js:333`
  - Current client rendering: `/Users/cayde/Workspace/oppa/oba-agent/apps/client/App.js`
  - Current docs: `/Users/cayde/Workspace/oppa/oba-agent/docs/ggui-workbench.md`

  **Acceptance Criteria**:
  - [ ] Response supports multiple `gguiAttachments`.
  - [ ] Attachments render inside assistant answer bubble.
  - [ ] Invalid attachment payload shows inline error component.
  - [ ] Real-data fixture proves ggui is not a mock-only path.

  **QA Scenarios**:
  ```text
  Scenario: Inline ggui with real collected data
    Tool: Browser plugin
    Steps: Ask for a generated visual answer requiring data collection.
    Expected: Assistant bubble contains text plus inline component with provenance.
    Evidence: evidence/profiled-direct-engine/task-10-inline-ggui.png

  Scenario: Bad ggui payload
    Tool: bash
    Steps: Fake main profile returns malformed ggui attachment.
    Expected: Inline error component appears; app does not crash.
    Evidence: evidence/profiled-direct-engine/task-10-bad-ggui.md
  ```

  **Commit**: YES | Message: `feat(ggui): render dynamic surfaces inline` | Files: `services/agent-gateway/src/*`, `apps/client/App.js`, `services/agent-gateway/test/http.test.js`

- [ ] 11. Browser Microphone Voice Flow

  **What to do**: Replace hidden file input behavior with browser microphone recording using `navigator.mediaDevices.getUserMedia` and `MediaRecorder`. A second click stops recording. Send recorded Blob as multipart `audio` to `/voice/transcribe`, then place returned text into the input without auto-sending. Add duration, size, MIME, temp-file cleanup, and timeout limits.
  **Must NOT do**: Do not open a file picker for normal users. Do not allow arbitrary JSON `audioPath` outside test/dev mode.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 13 | Blocked By: 4

  **References**:
  - Replace target: `/Users/cayde/Workspace/oppa/oba-agent/apps/client/App.js:133`
  - Replace target: `/Users/cayde/Workspace/oppa/oba-agent/apps/client/App.js:159`
  - Whisper endpoint: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/voice/whisper.js:25`

  **Acceptance Criteria**:
  - [ ] Normal UI has no file-picker voice path.
  - [ ] Permission denied shows actionable Korean error.
  - [ ] Multipart microphone Blob reaches whisper.cpp adapter.
  - [ ] Temp audio files are cleaned after success and failure.

  **QA Scenarios**:
  ```text
  Scenario: Microphone transcript fills input
    Tool: Browser plugin
    Steps: Open `http://127.0.0.1:8081/`, grant fake media stream, click Voice, record fixture speech, stop.
    Expected: Message input contains deterministic transcript and does not auto-send.
    Evidence: evidence/profiled-direct-engine/task-11-voice-browser.png

  Scenario: Permission denied
    Tool: Browser plugin
    Steps: Deny `getUserMedia`; click Voice.
    Expected: Korean permission error appears; app remains usable.
    Evidence: evidence/profiled-direct-engine/task-11-voice-denied.png
  ```

  **Commit**: YES | Message: `feat(client): record microphone voice input` | Files: `apps/client/App.js`, `services/agent-gateway/src/voice/whisper.js`, `services/agent-gateway/test/http.test.js`

- [ ] 12. Pretext Responsive Chat UI

  **What to do**: Add `@chenglou/pretext` for real production UI measurement paths: message line measurement, long Korean/English wrapping, inline chips/metadata, shrink-to-fit labels, and layout-jump prevention. Redesign chat-first UI to be compact and responsive. Debug becomes a secondary inspector showing profile id, context revision, compaction status, resource state, model route, main IO, EXAONE IO, and ggui trace.
  **Must NOT do**: Do not treat Pretext as a full UI framework. Do not add oversized whitespace or separate generated-UI panels.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 13 | Blocked By: 10

  **References**:
  - Current UI: `/Users/cayde/Workspace/oppa/oba-agent/apps/client/App.js`
  - External: `https://github.com/chenglou/pretext/blob/796b4691ca782ec44df9eb5d470abeca4d25732f/src/layout.ts#L682` - `prepare`/`layout`.
  - External: `https://github.com/chenglou/pretext/blob/796b4691ca782ec44df9eb5d470abeca4d25732f/src/rich-inline.ts#L158` - rich inline layout.

  **Acceptance Criteria**:
  - [ ] Pretext is used in at least one production UI path.
  - [ ] Missing `Intl.Segmenter` or Canvas measurement falls back cleanly.
  - [ ] Desktop, tablet, and mobile layouts have no overlapping text/controls.
  - [ ] Debug inspector does not dominate normal chat layout.

  **QA Scenarios**:
  ```text
  Scenario: Responsive long mixed-language answer
    Tool: Browser plugin
    Steps: Send long Korean/English mixed prompt at desktop and mobile widths.
    Expected: Text wraps cleanly; no giant blank region; controls remain reachable.
    Evidence: evidence/profiled-direct-engine/task-12-responsive.png

  Scenario: Pretext fallback
    Tool: Browser plugin
    Steps: Simulate missing `Intl.Segmenter`/Canvas measurement.
    Expected: CSS fallback renders without crash; debug records fallback.
    Evidence: evidence/profiled-direct-engine/task-12-pretext-fallback.md
  ```

  **Commit**: YES | Message: `feat(ui): improve responsive chat with pretext` | Files: `apps/client/*`

- [ ] 13. Config, Docs, And Real E2E Verification

  **What to do**: Update `.env.example`, README, architecture docs, EXAONE docs, ggui docs, and development setup. Document the single profiled engine, profile defaults, compaction threshold `0.9`, resource lifecycle, model switching, self-improvement lane, Voice microphone flow, Pretext role, and Codex parity matrix. Add real local checks for LM Studio EXAONE, whisper.cpp, profile gating, compaction, and Browser UI.
  **Must NOT do**: Do not document Codex app-server as runtime. Do not document upload picker as normal Voice UX. Do not leave old "two direct engines" language.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: Final Verification | Blocked By: 1,2,3,4,5,6,7,8,9,10,11,12

  **References**:
  - Current README: `/Users/cayde/Workspace/oppa/oba-agent/README.md`
  - Current architecture docs: `/Users/cayde/Workspace/oppa/oba-agent/docs/architecture.md`
  - Current EXAONE docs: `/Users/cayde/Workspace/oppa/oba-agent/docs/exaone-expression-layer.md`
  - Current config: `/Users/cayde/Workspace/oppa/oba-agent/services/agent-gateway/src/config.js`

  **Acceptance Criteria**:
  - [ ] Docs say main and EXAONE reuse the same profiled engine.
  - [ ] Docs say EXAONE profile disables tools/MCP by profile config.
  - [ ] Docs explain `OBA_CONTEXT_COMPACTION_THRESHOLD=0.9`.
  - [ ] Docs explain Codex app-server is implementer only.
  - [ ] Real Browser-plugin E2E covers context, compaction debug, profile gating, ggui, voice, and responsive UI.

  **QA Scenarios**:
  ```text
  Scenario: Documentation source scan
    Tool: bash
    Steps: `rg -n "two direct engines|Codex app-server.*runtime|upload picker|restaurant-only|EXAONE.*separate engine" README.md docs apps/client services/agent-gateway/src -S`.
    Expected: No stale architecture language remains.
    Evidence: evidence/profiled-direct-engine/task-13-doc-scan.md

  Scenario: Real profiled engine E2E
    Tool: Browser plugin + bash
    Steps: Start gateway, client, LM Studio with `exaone-4.0-1.2b`, and whisper.cpp; run two-turn chat, force compaction threshold in test config, request inline ggui, use Voice.
    Expected: Debug shows same engine with `main-agent` and `exaone-agent` profiles, compaction at 0.9, EXAONE LM Studio route, inline ggui, and voice transcript.
    Evidence: evidence/profiled-direct-engine/task-13-real-e2e.png
  ```

  **Commit**: YES | Message: `docs(engine): document profiled engine runtime` | Files: `README.md`, `.env.example`, `docs/*`, `services/agent-gateway/test/*`

## Final Verification Wave
> ALL must APPROVE before calling the project done.
- [ ] F1. Plan Compliance Audit
  - Verify only one direct engine implementation exists for both profiles.
  - Verify Codex app-server is absent from `/turn` runtime.
  - Verify profile capability selection is code/config/env controlled.
- [ ] F2. Codex Runtime Parity Audit
  - Verify parity matrix rows for compaction, cancellation, MCP/tool gating, allow/deny, lifecycle cleanup, persistence, and shutdown have evidence.
  - Verify missing Codex behavior is either implemented or explicitly out of scope with rationale.
- [ ] F3. Engine Behavior Review
  - Verify main profile gets tools/MCP/ggui.
  - Verify EXAONE profile gets no tools/MCP and cannot execute side effects.
  - Verify compaction threshold is exactly `0.9` unless explicitly overridden in a test.
- [ ] F4. Resource Leak Review
  - Verify cancelled turns, provider timeouts, MCP failures, hook failures, whisper failures, and shutdown leave no dangling timers/processes/temp files.
- [ ] F5. Browser QA
  - Use Browser plugin only.
  - Verify responsive UI, inline ggui, debug inspector, microphone Voice, and context continuity.

## Commit Strategy
- Commit per task only after tests and evidence pass.
- Do not squash until final review approves.
- Do not commit credential files, captured audio blobs, temp conversation stores, or self-improvement scratch artifacts.

## Success Criteria
- Main and EXAONE are profiles of one direct engine, not separate engines.
- EXAONE profile disables tool/MCP capabilities before provider request construction.
- Context and compaction are first-class engine features with threshold `0.9`.
- Resource lifecycle behavior is tested: cancellation, timeout, cleanup, shutdown.
- Codex CLI source parity is documented and verified feature-by-feature.
- Self-improvement is mandatory, internal, versioned, and failure-tolerant.
- Default emotional model route is LM Studio + `exaone-4.0-1.2b`, and it is swappable by config.
- ggui is dynamic and inline in answer bubbles.
- Voice is microphone capture into whisper.cpp, not upload UX.
- UI is compact, responsive, and uses Pretext for real text layout stability.
