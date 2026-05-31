# Profiled Engine ULW Execution Refinement

## TL;DR
> Summary:      Execute the seven existing ULW goals from `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json` as one dependency-managed run, preserving the approved profiled direct-engine plan and adding the missing fourth real-usage criterion for each goal before recording PASS.
> Deliverables:
> - Dependency waves for G001-G007
> - Worker ownership and exact file scopes per goal
> - TDD-first execution rules with characterization tests before behavior changes
> - Browser-plugin-only browser QA, with no standalone Playwright
> - Real ULW evidence paths under `.omo/ulw-loop/evidence/`
> Effort:       XL
> Risk:         High - Shared engine, context lifecycle, MCP/tool gating, client UI, and evidence state all converge on the same `/turn` runtime.

## Scope
### Must have
- Execute only the seven persisted goals in `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json:11`, preserving the order from `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/brief.md:3`.
- Before implementation evidence is recorded, revise every goal to have at least four observable success criteria, because `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/brief.md:19` requires at least four and `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json:15` currently has only C001-C003 per goal.
- Use `.omo/ulw-loop/evidence/G00x-C00x-<slug>.<ext>` as the authoritative evidence namespace for ULW completion.
- Preserve the approved architecture: one reusable direct engine with `main-agent` and `exaone-agent` profiles from `plans/codex-engine-context-voice.md:28`.
- Keep `main-agent` tools/MCP/ggui enabled and `exaone-agent` tools/MCP/ggui execution disabled as defined in `plans/codex-engine-context-voice.md:86`.
- Apply TDD to each implementation lane: characterization test first for touched existing behavior, failing new test second, minimal implementation third.
- Delegate every code edit, test write, fix, and QA execution to right-sized workers; the orchestrator reads diffs, reruns tests, verifies evidence, records ledger entries, and closes workers.
- Use Browser plugin for all browser-facing QA through the in-app Browser workflow in `/Users/cayde/.codex/plugins/cache/openai-bundled/browser/26.527.31326/skills/control-in-app-browser/SKILL.md:28`.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No Codex app-server as `/turn` runtime, per `plans/codex-engine-context-voice.md:115`.
- No duplicate main/EXAONE engine loops; current split at `services/agent-gateway/src/index.js:61` and `services/agent-gateway/src/index.js:295` must collapse into one profiled entrypoint.
- No model-decided capability attachment; profile/config/env owns capability selection.
- No EXAONE provider request with tool specs, MCP tools, app/plugin tools, or side-effect permissions.
- No standalone Playwright, external browser automation server, or Computer Use fallback for browser-facing criteria while Browser plugin is available.
- No evidence recorded as PASS without a real channel artifact and cleanup receipt, per `/Users/cayde/.codex/plugins/cache/sisyphuslabs/omo/0.1.0/skills/ulw-loop/SKILL.md:142`.
- No reverting unrelated dirty worktree changes; worker ownership must avoid files outside each task scope.
- No upload picker as normal Voice UX; current file-picker path in `apps/client/App.js:159` is replacement scope only.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + Node `node:test` for gateway, `npm --prefix apps/client run check` for client syntax, Expo web export for browser surface.
- QA policy: every task has agent-executed scenarios
- Evidence: `.omo/ulw-loop/evidence/G00x-C00x-<slug>.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: ULW state, evidence contract, and worker orchestration preflight
- Task 2: G001 Codex parity and engine profile foundation
- Task 3: G002 context memory, token accounting, compaction, and resource lifecycle

Wave 2 (after Wave 1):
- Task 4: G004 capability gating and dynamic ggui inline attachments; depends [1, 2, 3]
- Task 5: G005 self-improvement, hook safety, and prompt/skill evolution; depends [1, 2, 3]

Wave 3 (after Wave 2):
- Task 6: G003 shared profiled engine and main-to-EXAONE orchestration; depends [2, 3, 4]
- Task 7: G006 Browser microphone Voice and Pretext responsive UI; depends [3, 4]

Wave 4 (after Wave 3):
- Task 8: G007 final docs, real E2E, and quality gate; depends [1, 2, 3, 4, 5, 6, 7]

Critical path: Task 1 -> Task 2 -> Task 4 -> Task 6 -> Task 8

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 2, 3, 4, 5, 6, 7, 8 | 2, 3 |
| 2    | none       | 4, 5, 6, 8 | 1, 3 |
| 3    | none       | 4, 5, 6, 7, 8 | 1, 2 |
| 4    | 1, 2, 3    | 6, 7, 8 | 5 |
| 5    | 1, 2, 3    | 8 | 4 |
| 6    | 2, 3, 4    | 8 | 7 |
| 7    | 3, 4       | 8 | 6 |
| 8    | 1, 2, 3, 4, 5, 6, 7 | Final verification | none |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. ULW State, Evidence Contract, And Worker Orchestration Preflight

  What to do: Use structured ULW steering to add C004 criteria to G001-G007, because the brief requires at least four criteria per goal. Normalize evidence paths to `.omo/ulw-loop/evidence/G00x-C00x-<slug>.<ext>`. Prepare worker launch messages that include exact file ownership, "not alone in the codebase" coordination, TDD rules, verification commands, QA channel, evidence path, adversarial classes, and cleanup receipt requirements. Do not edit product code in this task.
  Must NOT do: Do not hand-edit `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json`; mutate ULW state only through `omo ulw-loop steer`. Do not record PASS for any goal in this preflight.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [2, 3, 4, 5, 6, 7, 8] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/brief.md:19` - requires at least four success criteria and real-usage evidence.
  - Pattern:  `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json:15` - current criteria arrays start at three criteria and need C004.
  - Pattern:  `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/ledger.jsonl:1` - audit trail for created and revised goals.
  - Pattern:  `/Users/cayde/.codex/plugins/cache/sisyphuslabs/omo/0.1.0/skills/ulw-loop/SKILL.md:28` - delegate code, tests, fixes, and QA to workers.
  - Pattern:  `/Users/cayde/.codex/plugins/cache/sisyphuslabs/omo/0.1.0/skills/ulw-loop/SKILL.md:142` - evidence and cleanup requirements before PASS.
  - Pattern:  `/Users/cayde/.codex/plugins/cache/sisyphuslabs/omo/0.1.0/skills/start-work/SKILL.md:76` - worker message contents and exact QA invocation requirements.
  - Test:     `package.json:11` - top-level Node test command the workers must keep green.
  - External: `https://github.com/vercel-labs/agent-browser` - fallback named by ULW docs only if Browser/Chrome is not available; do not use while Browser plugin is available.

  Acceptance criteria (agent-executable only):
  - [ ] `node -e 'const s=require("fs").readFileSync(".omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json","utf8"); const g=JSON.parse(s).goals; if(g.length!==7||g.some(x=>x.successCriteria.length<4)) process.exit(1)'` exits 0.
  - [ ] `rg -n '"expectedEvidence": "\\.omo/ulw-loop/evidence/G00[1-7]-C00[1-4]-' .omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json` finds all expected criteria evidence paths.
  - [ ] `tail -n 20 .omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/ledger.jsonl` includes evidence-backed `revise_criterion` entries for C004 additions.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: all seven goals have a fourth criterion
    Tool:     bash
    Steps:    node -e 'const g=JSON.parse(require("fs").readFileSync(".omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json","utf8")).goals; console.log(g.map(x=>`${x.id}:${x.successCriteria.length}`).join("\n")); if(g.some(x=>x.successCriteria.length<4)) process.exit(1)' > .omo/ulw-loop/evidence/G000-C004-criteria-count.txt
    Expected: File lists all seven goals with criterion count >=4 and command exits 0.
    Evidence: .omo/ulw-loop/evidence/G000-C004-criteria-count.txt

  Scenario: evidence namespace is not split
    Tool:     bash
    Steps:    node -e 'const g=JSON.parse(require("fs").readFileSync(".omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json","utf8")).goals; const bad=g.flatMap(goal=>goal.successCriteria.filter(c=>!String(c.expectedEvidence||"").startsWith(".omo/ulw-loop/evidence/")).map(c=>`${goal.id}:${c.id}:${c.expectedEvidence}`)); if(bad.length){console.log(bad.join("\n")); process.exit(1)} console.log("ok")' > .omo/ulw-loop/evidence/G000-C004-evidence-namespace.txt
    Expected: File contains `ok`; no criterion points to `evidence/profiled-direct-engine`.
    Evidence: .omo/ulw-loop/evidence/G000-C004-evidence-namespace.txt
  ```

  Commit: YES | Message: `chore(ulw): refine profiled engine goal evidence` | Files: [`.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/goals.json`, `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/ledger.jsonl`, `.omo/ulw-loop/evidence/*`]

- [ ] 2. G001 Codex Parity And Engine Profile Foundation

  What to do: Delegate one worker for `docs/codex-runtime-parity.md` and one worker for `AgentProfileRegistry`. The profile worker owns `services/agent-gateway/src/engine/profiles.js`, profile-related config validation, and `services/agent-gateway/test/engine-profile.test.js`. The parity worker owns docs and parity tests only. Keep existing `toolMode: "disabled"` regression behavior while introducing server-side profile selection.
  Must NOT do: Do not expose capability selection to model output or request payload. Do not duplicate engine loops. Do not replace current tests without first pinning current behavior.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [4, 5, 6, 8] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `plans/codex-engine-context-voice.md:169` - original Task 1 parity matrix scope.
  - Pattern:  `plans/codex-engine-context-voice.md:205` - original Task 2 profile registry scope.
  - Pattern:  `services/agent-gateway/src/engine/agent.js:10` - current `runAgentTurn` entrypoint and `toolMode` seam.
  - Pattern:  `services/agent-gateway/src/engine/agent.js:31` - current tools array is empty only when `toolMode === "disabled"`.
  - API/Type: `services/agent-gateway/src/config.js:1` - config loader where profile env validation must be added.
  - Test:     `services/agent-gateway/test/engine.test.js:187` - existing disabled-tools regression to preserve.
  - Test:     `package.json:11` - top-level gateway test command.
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/turn.rs#L659-L708` - source-pinned compaction behavior for parity matrix.

  Acceptance criteria (agent-executable only):
  - [ ] `node --test services/agent-gateway/test/engine-profile.test.js services/agent-gateway/test/engine.test.js` passes.
  - [ ] `rg -n "TODO|unknown|later" docs/codex-runtime-parity.md` returns no matches.
  - [ ] A profile unit test proves `main-agent` has tools/MCP/ggui/reasoning/self-improvement and `exaone-agent` has tools/MCP/ggui execution disabled.
  - [ ] A request payload trying to enable EXAONE tools is rejected or ignored before provider request construction.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: profile registry and parity matrix pass
    Tool:     tmux
    Steps:    tmux new-session -d -s ulw-qa-G001-C001 'cd /Users/cayde/Workspace/oppa/oba-agent && node --test services/agent-gateway/test/engine-profile.test.js services/agent-gateway/test/engine.test.js; rg -n "TODO|unknown|later" docs/codex-runtime-parity.md || true'; tmux capture-pane -pt ulw-qa-G001-C001 -S -2000 > .omo/ulw-loop/evidence/G001-C001-profile-registry.txt; tmux kill-session -t ulw-qa-G001-C001
    Expected: Transcript shows passing tests and no unresolved parity placeholders.
    Evidence: .omo/ulw-loop/evidence/G001-C001-profile-registry.txt

  Scenario: invalid profile config fails closed
    Tool:     tmux
    Steps:    tmux new-session -d -s ulw-qa-G001-C002 'cd /Users/cayde/Workspace/oppa/oba-agent && OBA_AGENT_PROFILES_JSON="{bad" node services/agent-gateway/src/index.js'; sleep 2; tmux capture-pane -pt ulw-qa-G001-C002 -S -2000 > .omo/ulw-loop/evidence/G001-C002-invalid-profile.txt; tmux kill-session -t ulw-qa-G001-C002 || true
    Expected: Transcript contains a typed config/profile error and the gateway does not run in partial state.
    Evidence: .omo/ulw-loop/evidence/G001-C002-invalid-profile.txt
  ```

  Commit: YES | Message: `feat(engine): add codex parity and static profiles` | Files: [`docs/codex-runtime-parity.md`, `services/agent-gateway/src/engine/profiles.js`, `services/agent-gateway/src/config.js`, `services/agent-gateway/test/engine-profile.test.js`, `services/agent-gateway/test/engine.test.js`]

- [ ] 3. G002 Context Memory, Token Accounting, Compaction, And Resource Lifecycle

  What to do: Delegate memory and resource workers with non-overlapping ownership. Memory worker owns `services/agent-gateway/src/engine/memory-store.js`, `services/agent-gateway/src/engine/context-compactor.js`, token counting, per-conversation locks, and `services/agent-gateway/test/context-compaction.test.js`. Resource worker owns `services/agent-gateway/src/engine/resource-manager.js`, cancellation/timeout/cleanup wiring, whisper temp cleanup, and `services/agent-gateway/test/resource-manager.test.js`. Both workers must pin current stateless `/turn` behavior before changing context replay.
  Must NOT do: Do not use one global conversation file. Do not replay unbounded raw history. Do not leave temp audio files, provider requests, MCP clients, or timers after cancellation/shutdown.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [4, 5, 6, 7, 8] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `plans/codex-engine-context-voice.md:240` - original context memory and compaction task.
  - Pattern:  `plans/codex-engine-context-voice.md:277` - original resource manager task.
  - Pattern:  `services/agent-gateway/src/index.js:65` - current `/turn` receives `conversationId` but does not persist memory.
  - Pattern:  `services/agent-gateway/src/engine/agent.js:30` - current prompt starts stateless with only current message.
  - Pattern:  `services/agent-gateway/src/clients/exaone.js:203` - existing timeout signal pattern to reuse.
  - Pattern:  `services/agent-gateway/src/voice/whisper.js:102` - current multipart temp dir creation needing cleanup.
  - Test:     `services/agent-gateway/test/http.test.js:116` - `/turn` response regression surface.
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/turn.rs#L264-L299` - source-pinned mid-turn compaction behavior.

  Acceptance criteria (agent-executable only):
  - [ ] `node --test services/agent-gateway/test/context-compaction.test.js services/agent-gateway/test/resource-manager.test.js services/agent-gateway/test/http.test.js` passes.
  - [ ] Same `conversationId` replays context into both profiles with a context revision id.
  - [ ] `OBA_CONTEXT_WINDOW_TOKENS=1000 OBA_CONTEXT_COMPACTION_THRESHOLD=0.9` compacts after >900 estimated tokens.
  - [ ] Concurrent same-conversation turns serialize or fail with a typed lock error without corrupting memory.
  - [ ] Cancelled/hung provider and whisper failure paths produce cleanup receipts with zero temp dirs/timers left.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: compaction through live HTTP
    Tool:     curl
    Steps:    PORT=8787 OBA_CONTEXT_WINDOW_TOKENS=1000 OBA_CONTEXT_COMPACTION_THRESHOLD=0.9 node services/agent-gateway/src/index.js in tmux; then curl -i -sS http://127.0.0.1:8787/turn -H 'Content-Type: application/json' --data '{"conversationId":"ulw-G002","message":"<901-token fixture text>","metadata":{"debug":true}}' > .omo/ulw-loop/evidence/G002-C001-compaction-http.txt; stop gateway and record cleanup receipt.
    Expected: HTTP 200 response metadata/debug contains compaction summary and context revision.
    Evidence: .omo/ulw-loop/evidence/G002-C001-compaction-http.txt

  Scenario: corruption and cancellation fail safely
    Tool:     tmux
    Steps:    tmux new-session -d -s ulw-qa-G002-C002 'cd /Users/cayde/Workspace/oppa/oba-agent && node scripts/qa/context-corruption-and-cancel.mjs'; tmux capture-pane -pt ulw-qa-G002-C002 -S -4000 > .omo/ulw-loop/evidence/G002-C002-concurrency-corruption.txt; tmux kill-session -t ulw-qa-G002-C002
    Expected: Transcript shows typed corruption/lock error, provider abort, timer cleanup, and no corrupted write.
    Evidence: .omo/ulw-loop/evidence/G002-C002-concurrency-corruption.txt
  ```

  Commit: YES | Message: `feat(engine): add context memory compaction and resources` | Files: [`services/agent-gateway/src/engine/memory-store.js`, `services/agent-gateway/src/engine/context-compactor.js`, `services/agent-gateway/src/engine/resource-manager.js`, `services/agent-gateway/src/voice/whisper.js`, `services/agent-gateway/src/config.js`, `services/agent-gateway/test/context-compaction.test.js`, `services/agent-gateway/test/resource-manager.test.js`, `services/agent-gateway/test/http.test.js`]

- [ ] 4. G004 Capability Gating And Dynamic ggui Inline Attachments

  What to do: Delegate backend capability gating and API contract workers. Backend worker owns profile-gated tools/MCP/ggui capability resolution, lazy/profile-scoped MCP discovery, EXAONE tool-call blocking, and tests. Contract worker owns multi-attachment response shape `gguiAttachments[]`, removal of restaurant-only naming in backend fixtures, provenance/error states, and migration compatibility from current `surface`. Coordinate before touching `services/agent-gateway/src/index.js`.
  Must NOT do: Do not discover MCP for EXAONE turns. Do not expose tools to EXAONE and merely reject later. Do not keep only the first surface as the public contract.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [6, 7, 8] | Blocked by: [1, 2, 3]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `plans/codex-engine-context-voice.md:313` - original capability modules task.
  - Pattern:  `plans/codex-engine-context-voice.md:490` - original dynamic ggui inline contract task.
  - Pattern:  `services/agent-gateway/src/tools/registry.js:47` - current default built-in registry creation.
  - Pattern:  `services/agent-gateway/src/mcp/adapter.js:13` - current eager MCP discovery path.
  - Pattern:  `services/agent-gateway/src/engine/agent.js:200` - current tool execution and ggui surface attachment.
  - Pattern:  `services/agent-gateway/src/index.js:333` - current `firstAttachedSurface` truncates to one surface.
  - Pattern:  `services/agent-gateway/src/ggui/render.js:3` - current supported ggui intent types include restaurant-specific aliases.
  - Test:     `services/agent-gateway/test/mcp.test.js` - MCP behavior regression surface.
  - Test:     `services/agent-gateway/test/ggui-render.test.js` - ggui render contract surface.
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/config/src/mcp_types.rs#L165-L175` - source-pinned allow/deny filtering reference.

  Acceptance criteria (agent-executable only):
  - [ ] `node --test services/agent-gateway/test/profile-capabilities.test.js services/agent-gateway/test/mcp.test.js services/agent-gateway/test/ggui-render.test.js services/agent-gateway/test/http.test.js` passes.
  - [ ] Main profile provider requests include allowed built-in, MCP, and ggui tools.
  - [ ] EXAONE profile provider requests include no tool specs and block tool-call-like output before execution with `PROFILE_TOOL_CALL_BLOCKED`.
  - [ ] Public `/turn` response can carry multiple `gguiAttachments[]` with provenance and per-attachment error states.
  - [ ] Backward compatibility for current `surface` is either tested as deprecated or explicitly removed in docs and client migration.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: main capabilities and multi-ggui attachments
    Tool:     curl
    Steps:    Start gateway with fake MCP and fake provider; curl -i -sS http://127.0.0.1:8787/turn -H 'Content-Type: application/json' --data '{"conversationId":"ulw-G004","message":"create two inline comparison surfaces","metadata":{"debug":true}}' > .omo/ulw-loop/evidence/G004-C001-main-capabilities.txt; stop gateway and record cleanup receipt.
    Expected: HTTP 200 body shows main provider received allowed MCP/ggui tools and response contains `gguiAttachments` length 2 with provenance.
    Evidence: .omo/ulw-loop/evidence/G004-C001-main-capabilities.txt

  Scenario: EXAONE tool calls are blocked before side effects
    Tool:     curl
    Steps:    Start gateway with fake EXAONE returning `tool_calls`; curl -i -sS http://127.0.0.1:8787/turn -H 'Content-Type: application/json' --data '{"conversationId":"ulw-G004-block","message":"try emotional tool call","metadata":{"debug":true}}' > .omo/ulw-loop/evidence/G004-C002-exaone-tool-block.txt; stop gateway and record cleanup receipt.
    Expected: HTTP response/debug contains `PROFILE_TOOL_CALL_BLOCKED`; no MCP discovery and no tool execution event for EXAONE.
    Evidence: .omo/ulw-loop/evidence/G004-C002-exaone-tool-block.txt
  ```

  Commit: YES | Message: `feat(engine): gate capabilities and ggui attachments` | Files: [`services/agent-gateway/src/engine/*`, `services/agent-gateway/src/mcp/*`, `services/agent-gateway/src/tools/*`, `services/agent-gateway/src/ggui/*`, `services/agent-gateway/src/index.js`, `services/agent-gateway/test/profile-capabilities.test.js`, `services/agent-gateway/test/mcp.test.js`, `services/agent-gateway/test/ggui-render.test.js`, `services/agent-gateway/test/http.test.js`]

- [ ] 5. G005 Self-Improvement, Hook Safety, And Prompt/Skill Evolution

  What to do: Delegate self-improvement staging and hook-safety workers. Self-improvement worker owns candidate staging, rollback metadata, versioned main/EXAONE prompt targets, sanitized Codex implementer instructions, and tests. Hook worker owns hook timeout/output limits, diagnostic evidence, redaction, failure tolerance, and tests. Runtime must continue when Codex implementer is unavailable or hooks throw.
  Must NOT do: Do not expose self-improvement controls in normal chat. Do not let runtime model edit code, hooks, skills, workflows, or prompts directly. Do not auto-apply candidates without versioned staging and rollback.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [8] | Blocked by: [1, 2, 3]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `plans/codex-engine-context-voice.md:420` - original self-improvement engine module task.
  - Pattern:  `plans/codex-engine-context-voice.md:456` - original hook failure diagnostics task.
  - Pattern:  `services/agent-gateway/src/self-improvement.js:6` - required candidate element list already includes node, skill, hook, main prompt, EXAONE prompt.
  - Pattern:  `services/agent-gateway/src/self-improvement.js:91` - current candidate artifact writer.
  - Pattern:  `services/agent-gateway/src/workflows/candidate-node-handlers.js:72` - existing workflow hook proposal validation reference.
  - Test:     `services/agent-gateway/test/workflow-evolution-candidates.test.js:27` - existing hook candidate tests.
  - Test:     `services/agent-gateway/test/http.test.js:646` - existing self-improvement HTTP test area.
  - External: `https://developers.openai.com/codex/cli` - Codex CLI as isolated implementer reference only, never `/turn` runtime.

  Acceptance criteria (agent-executable only):
  - [ ] `node --test services/agent-gateway/test/self-improvement.test.js services/agent-gateway/test/hook-safety.test.js services/agent-gateway/test/workflow-evolution-candidates.test.js services/agent-gateway/test/http.test.js` passes.
  - [ ] Self-improvement candidates are staged for skill, hook, workflow/node spec, main prompt, and EXAONE prompt with rollback metadata.
  - [ ] `/turn` succeeds when Codex implementer is disabled/unavailable.
  - [ ] Throwing and hung hooks produce diagnostic evidence and do not crash `/turn`.
  - [ ] Hook proposal without timeout/failure policy is rejected.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: self-improvement candidates are staged with rollback
    Tool:     curl
    Steps:    Start gateway; curl -i -sS http://127.0.0.1:8787/self-improvement/candidates -H 'Content-Type: application/json' --data '{"runId":"ulw-G005","workflowPath":"fixtures/workflows/evolution-candidates.yml","input":{"target":"all"}}' > .omo/ulw-loop/evidence/G005-C001-self-improvement-candidates.txt; stop gateway and record cleanup receipt.
    Expected: HTTP 200 body lists five versioned artifacts and rollback metadata paths.
    Evidence: .omo/ulw-loop/evidence/G005-C001-self-improvement-candidates.txt

  Scenario: hook failure does not crash turn
    Tool:     curl
    Steps:    Start gateway with test throwing hook and Codex implementer disabled; curl -i -sS http://127.0.0.1:8787/turn -H 'Content-Type: application/json' --data '{"conversationId":"ulw-G005-hook","message":"hello","metadata":{"debug":true}}' > .omo/ulw-loop/evidence/G005-C002-hook-failure-runtime.txt; stop gateway and record cleanup receipt.
    Expected: HTTP 200 turn response plus diagnostic hook evidence; no uncaught exception.
    Evidence: .omo/ulw-loop/evidence/G005-C002-hook-failure-runtime.txt
  ```

  Commit: YES | Message: `feat(engine): add self improvement and hook safety` | Files: [`services/agent-gateway/src/self-improvement.js`, `services/agent-gateway/src/engine/*`, `services/agent-gateway/src/workflows/*`, `prompts/*`, `fixtures/workflows/*`, `services/agent-gateway/test/self-improvement.test.js`, `services/agent-gateway/test/hook-safety.test.js`, `services/agent-gateway/test/workflow-evolution-candidates.test.js`]

- [ ] 6. G003 Shared Profiled Engine And Main-To-EXAONE Orchestration

  What to do: Delegate one backend integration worker to refactor `/turn` so `main-agent` and `exaone-agent` both call the same `runProfiledAgentTurn()` module with different profiles. Add emotional model router envs `OBA_EMOTIONAL_MODEL_PROVIDER`, `OBA_EMOTIONAL_MODEL_BASE_URL`, `OBA_EMOTIONAL_MODEL_NAME`, `OBA_EMOTIONAL_MODEL_API_KEY`, and timeout while preserving compatibility with current LM Studio defaults. Remove separate finalizer-only EXAONE loop after tests prove same-engine calls.
  Must NOT do: Do not create `runExaoneTurn()` as a separate loop. Do not hard-code LM Studio so model/provider switching requires code edits. Do not remove EXAONE tool denial from the shared-engine parse layer.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [8] | Blocked by: [2, 3, 4]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `plans/codex-engine-context-voice.md:349` - original shared profiled engine entrypoint task.
  - Pattern:  `plans/codex-engine-context-voice.md:385` - original main-to-EXAONE orchestration and model router task.
  - Pattern:  `services/agent-gateway/src/index.js:61` - current `/turn` first runs `runAgentTurn`.
  - Pattern:  `services/agent-gateway/src/index.js:295` - current EXAONE finalizer is a separate post-processing path.
  - Pattern:  `services/agent-gateway/src/clients/exaone.js:3` - current LM Studio defaults.
  - API/Type: `services/agent-gateway/src/config.js:46` - current `OBA_LLM_*`/`EXAONE_*` config names needing migration.
  - Test:     `services/agent-gateway/test/http.test.js:116` - current `/turn` EXAONE final answer behavior.
  - Test:     `services/agent-gateway/test/lmstudio.test.js:46` - LM Studio fake-server route.
  - External: `https://github.com/openai/codex/blob/966932124c243aab71719c269d79305844f35814/codex-rs/core/src/session/session.rs#L1135-L1196` - source-pinned runtime cancellation/re-init reference.

  Acceptance criteria (agent-executable only):
  - [ ] `node --test services/agent-gateway/test/profiled-engine.test.js services/agent-gateway/test/http.test.js services/agent-gateway/test/lmstudio.test.js` passes.
  - [ ] Test proves `/turn` calls `runProfiledAgentTurn(main-agent)` then `runProfiledAgentTurn(exaone-agent)` from the same module.
  - [ ] Default emotional model route sends `exaone-4.0-1.2b`.
  - [ ] Setting `OBA_EMOTIONAL_MODEL_NAME=test-model` changes only the emotional route request model.
  - [ ] Unsupported emotional provider/model config fails with typed startup/config error and no partial runtime.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: shared engine route through live HTTP
    Tool:     curl
    Steps:    Start fake main provider and fake LM Studio; start gateway; curl -i -sS http://127.0.0.1:8787/turn -H 'Content-Type: application/json' --data '{"conversationId":"ulw-G003","message":"hello","metadata":{"debug":true}}' > .omo/ulw-loop/evidence/G003-C001-shared-engine-http.txt; stop all servers and record cleanup receipt.
    Expected: HTTP 200 debug shows same engine module called for `main-agent` then `exaone-agent`, final answer from EXAONE, and context revision on both.
    Evidence: .omo/ulw-loop/evidence/G003-C001-shared-engine-http.txt

  Scenario: model switch and bad config
    Tool:     tmux
    Steps:    tmux new-session -d -s ulw-qa-G003-C002 'cd /Users/cayde/Workspace/oppa/oba-agent && OBA_EMOTIONAL_MODEL_NAME=test-model node scripts/qa/fake-profiled-engine-route.mjs && OBA_EMOTIONAL_MODEL_PROVIDER=unsupported node services/agent-gateway/src/index.js'; tmux capture-pane -pt ulw-qa-G003-C002 -S -4000 > .omo/ulw-loop/evidence/G003-C002-bad-model-config.txt; tmux kill-session -t ulw-qa-G003-C002 || true
    Expected: Transcript shows fake LM Studio received `test-model` and unsupported provider fails with typed config error.
    Evidence: .omo/ulw-loop/evidence/G003-C002-bad-model-config.txt
  ```

  Commit: YES | Message: `feat(agent): orchestrate shared profiled turns` | Files: [`services/agent-gateway/src/engine/*`, `services/agent-gateway/src/index.js`, `services/agent-gateway/src/clients/*`, `services/agent-gateway/src/config.js`, `services/agent-gateway/test/profiled-engine.test.js`, `services/agent-gateway/test/http.test.js`, `services/agent-gateway/test/lmstudio.test.js`, `.env.example`]

- [ ] 7. G006 Browser Microphone Voice And Pretext Responsive UI

  What to do: Delegate one client worker for Voice/Pretext/debug UI and one backend worker for voice endpoint hardening only if Task 3 did not finish all cleanup/timeout hooks. Client worker owns `apps/client/App.js`, `apps/client/package.json`, and client tests/checks. Replace file-picker voice with `navigator.mediaDevices.getUserMedia` + `MediaRecorder`; keep JSON `audioPath` only behind explicit test/dev mode if needed. Add `@chenglou/pretext` to production UI measurement path, render multiple `gguiAttachments[]` inline inside assistant answer bubbles, and make debug a secondary inspector.
  Must NOT do: Do not use standalone Playwright for browser QA. Do not add a normal upload-picker voice UX. Do not create a separate generated-UI panel. Do not let debug dominate the chat layout.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [8] | Blocked by: [3, 4]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `plans/codex-engine-context-voice.md:525` - original Browser microphone Voice task.
  - Pattern:  `plans/codex-engine-context-voice.md:560` - original Pretext responsive UI task.
  - Pattern:  `apps/client/App.js:50` - current main client component.
  - Pattern:  `apps/client/App.js:133` - current file upload transcription helper.
  - Pattern:  `apps/client/App.js:159` - current `openAudioPicker` file-picker path to replace.
  - Pattern:  `apps/client/App.js:282` - hidden file input currently rendered on web.
  - Pattern:  `apps/client/App.js:343` - current message bubble and inline surface rendering.
  - Pattern:  `apps/client/App.js:412` - current debug panel.
  - API/Type: `services/agent-gateway/src/voice/whisper.js:19` - `/voice/transcribe` endpoint contract.
  - Test:     `apps/client/package.json:9` - client syntax check command.
  - External: `https://github.com/chenglou/pretext/blob/796b4691ca782ec44df9eb5d470abeca4d25732f/src/layout.ts#L682` - pinned Pretext layout reference.
  - External: `https://github.com/chenglou/pretext/blob/796b4691ca782ec44df9eb5d470abeca4d25732f/src/rich-inline.ts#L158` - pinned rich inline reference.

  Acceptance criteria (agent-executable only):
  - [ ] `npm --prefix apps/client run check` passes.
  - [ ] `npx expo export --platform web --output-dir /tmp/oba-client-web-profiled-engine` passes.
  - [ ] Normal web UI has no hidden file input or file-picker voice path.
  - [ ] Browser plugin QA proves fake microphone transcript populates input without auto-send.
  - [ ] Browser plugin QA proves permission denial shows Korean error and app remains usable.
  - [ ] Browser plugin screenshots at mobile and desktop widths show no text/control overlaps and inline ggui inside the answer bubble.
  - [ ] Pretext is used in a production measurement path with fallback when `Intl.Segmenter` or canvas measurement is missing.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: microphone transcript fills input
    Tool:     Browser plugin (in-app Browser via node_repl browser-client; no standalone Playwright)
    Steps:    Start gateway and `npm --prefix apps/client run web -- --port 8081` in tmux; in node_repl js import `/Users/cayde/.codex/plugins/cache/openai-bundled/browser/26.527.31326/scripts/browser-client.mjs`, run `setupBrowserRuntime`, select `iab`, open `http://127.0.0.1:8081/`, inject fake media stream fixture, click `[data-testid="voice-input"]`, stop recording, screenshot to `.omo/ulw-loop/evidence/G006-C001-voice-browser.png`; close browser tab and stop tmux sessions.
    Expected: Message input contains deterministic transcript and no message was sent.
    Evidence: .omo/ulw-loop/evidence/G006-C001-voice-browser.png

  Scenario: permission denied and Pretext fallback
    Tool:     Browser plugin (in-app Browser via node_repl browser-client; no standalone Playwright)
    Steps:    Open `http://127.0.0.1:8081/`, override `navigator.mediaDevices.getUserMedia` to reject, simulate missing `Intl.Segmenter` and canvas measure fallback, click `[data-testid="voice-input"]`, screenshot to `.omo/ulw-loop/evidence/G006-C002-voice-pretext-edge.png`; close browser tab and stop tmux sessions.
    Expected: Korean permission error appears, app remains usable, layout fallback renders without crash.
    Evidence: .omo/ulw-loop/evidence/G006-C002-voice-pretext-edge.png
  ```

  Commit: YES | Message: `feat(client): add microphone voice and pretext chat ui` | Files: [`apps/client/App.js`, `apps/client/package.json`, `apps/client/package-lock.json`, `services/agent-gateway/src/voice/whisper.js`, `services/agent-gateway/test/http.test.js`]

- [ ] 8. G007 Final Docs, Real E2E, And Quality Gate

  What to do: Delegate docs/config worker, command-verification QA worker, and Browser E2E QA worker in parallel after Tasks 1-7 pass. Docs worker owns `.env.example`, README, architecture, EXAONE, ggui, memory, development setup, and integration docs. Command QA worker owns test/export transcripts. Browser QA worker owns in-app Browser screenshots/action logs for profile gating, compaction debug, inline ggui, microphone Voice, model switching, and responsive layout. The orchestrator must rerun evidence checks, scan for forbidden stale language, close all workers, and checkpoint only after every criterion is PASS.
  Must NOT do: Do not document Codex app-server as runtime. Do not document upload picker as normal Voice UX. Do not leave old "two direct engines", "restaurant-only ggui", or standalone Playwright instructions. Do not mark final complete before explicit final verification approvals are surfaced.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [Final verification] | Blocked by: [1, 2, 3, 4, 5, 6, 7]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `plans/codex-engine-context-voice.md:595` - original docs/config/E2E task.
  - Pattern:  `plans/codex-engine-context-voice.md:632` - original final verification wave.
  - Pattern:  `README.md` - current product and QA docs.
  - Pattern:  `.env.example` - runtime env docs to update.
  - Pattern:  `docs/architecture.md` - architecture language to align.
  - Pattern:  `docs/exaone-expression-layer.md` - EXAONE routing docs.
  - Pattern:  `docs/ggui-workbench.md` - inline ggui docs.
  - Pattern:  `docs/development-setup.md` - local Browser/LM Studio/whisper setup docs.
  - Test:     `package.json:11` - full gateway tests.
  - Test:     `apps/client/package.json:9` - client check.
  - External: `/Users/cayde/.codex/plugins/cache/openai-bundled/browser/26.527.31326/skills/control-in-app-browser/SKILL.md:43` - only Node REPL browser-client controls in-app Browser; standalone automation is not allowed for this surface.

  Acceptance criteria (agent-executable only):
  - [ ] `node --test services/agent-gateway/test/*.test.js services/agent-gateway/test/*.test.mjs` passes with transcript at `.omo/ulw-loop/evidence/G007-C001-verification-suite.txt`.
  - [ ] `npm --prefix apps/client run check` passes and transcript is included in G007-C001 evidence.
  - [ ] `npx expo export --platform web --output-dir /tmp/oba-client-web-profiled-engine` passes and transcript is included in G007-C001 evidence.
  - [ ] `rg -n "two direct engines|Codex app-server.*runtime|upload picker|restaurant-only|standalone Playwright|EXAONE.*separate engine" README.md docs apps/client services/agent-gateway/src -S` returns no matches.
  - [ ] Browser plugin E2E evidence proves shared engine profiles, compaction at 0.9, EXAONE default route, model switching, inline ggui, microphone Voice, responsive UI, and cleanup receipts.
  - [ ] ULW ledger shows every G001-G007 criterion is PASS with observable evidence and cleanup.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: full verification suite and stale-language scan
    Tool:     tmux
    Steps:    tmux new-session -d -s ulw-qa-G007-C001 'cd /Users/cayde/Workspace/oppa/oba-agent && node --test services/agent-gateway/test/*.test.js services/agent-gateway/test/*.test.mjs && npm --prefix apps/client run check && npx expo export --platform web --output-dir /tmp/oba-client-web-profiled-engine && ! rg -n "two direct engines|Codex app-server.*runtime|upload picker|restaurant-only|standalone Playwright|EXAONE.*separate engine" README.md docs apps/client services/agent-gateway/src -S'; tmux capture-pane -pt ulw-qa-G007-C001 -S -8000 > .omo/ulw-loop/evidence/G007-C001-verification-suite.txt; tmux kill-session -t ulw-qa-G007-C001
    Expected: Transcript shows tests, client check, Expo export, and stale-language scan pass.
    Evidence: .omo/ulw-loop/evidence/G007-C001-verification-suite.txt

  Scenario: real Browser-plugin profiled engine E2E
    Tool:     Browser plugin (in-app Browser via node_repl browser-client; no standalone Playwright)
    Steps:    Start gateway, fake/real LM Studio route, fake whisper fixture, and `npm --prefix apps/client run web -- --port 8081` in tmux; use Browser plugin to open `http://127.0.0.1:8081/`, send two-turn chat, force compaction threshold in test config, request inline ggui, switch emotional model to `test-model`, use Voice, capture screenshot/action log to `.omo/ulw-loop/evidence/G007-C002-real-e2e.png`; close browser tab and kill tmux sessions.
    Expected: Debug shows same engine with `main-agent` and `exaone-agent`, EXAONE has no tools/MCP, compaction at 0.9, LM Studio route/model switch, inline ggui in assistant bubble, voice transcript, responsive layout, and cleanup receipt.
    Evidence: .omo/ulw-loop/evidence/G007-C002-real-e2e.png
  ```

  Commit: YES | Message: `docs(engine): finalize profiled engine qa and docs` | Files: [`README.md`, `.env.example`, `docs/*`, `services/agent-gateway/test/*`, `.omo/ulw-loop/evidence/*`, `.omo/ulw-loop/019e799c-c85f-7a22-a868-75f6a58d1939/ledger.jsonl`]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met
- [ ] F2. Code quality review - diagnostics clean, idioms match, no dead code
- [ ] F3. Real manual QA - every QA scenario executed with evidence captured
- [ ] F4. Scope fidelity - nothing extra shipped beyond Must-Have, nothing Must-NOT-Have introduced

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: plans/profiled-engine-ulw-execution-refinement.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
