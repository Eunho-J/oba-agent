# Codex Runtime Parity Matrix

## Scope

This matrix tracks the OBA direct runtime against pinned `openai/codex` runtime behavior. OBA uses one shared engine with server-side capability profiles:

- `main-agent`: tools, MCP, ggui, reasoning memory, self-improvement diagnostics.
- `exaone-agent`: same engine entrypoint, LM Studio emotional route, expression memory, no tool specs, no MCP discovery, no ggui execution.

Codex app-server is not part of `/turn` runtime. It can only be used as an isolated implementer for self-improvement work.

## Current Parity Rows

| Runtime Area | Codex Behavior | OBA Module | Current Evidence |
| --- | --- | --- | --- |
| Capability profiles | Capability surfaces are config-gated before runtime exposure. | `services/agent-gateway/src/engine/profiles.js`, `src/engine/profiled-agent.js` | `services/agent-gateway/test/engine-profile.test.js`, `services/agent-gateway/test/profiled-engine.test.js` |
| Tool-call disabling for EXAONE | Disabled capabilities are absent from model request construction. | `services/agent-gateway/src/engine/profiled-agent.js`, `src/clients/exaone.js` | `.omo/ulw-loop/evidence/G004-C002-exaone-tool-disabled.txt` |
| Context compaction | Token pressure is checked before and during turn work. | `services/agent-gateway/src/engine/context-compactor.js`, `src/engine/token-accounting.js` | `services/agent-gateway/test/context-compaction.test.js`, `.omo/ulw-loop/evidence/G002-C001-compaction-http.txt` |
| Resource lifecycle | Active work receives cancellation/timeout/cleanup management. | `services/agent-gateway/src/engine/resource-manager.js`, `src/index.js` | `services/agent-gateway/test/resource-manager.test.js`, `.omo/ulw-loop/evidence/G002-C003-resource-cancel.txt` |
| MCP discovery and filtering | MCP tools are discovered and filtered before provider request. | `services/agent-gateway/src/mcp/adapter.js`, `src/tools/registry.js` | `services/agent-gateway/test/mcp.test.js`, `services/agent-gateway/test/http.test.js` |
| Inline UI attachments | UI render capability is a tool result attached to the assistant answer. | `services/agent-gateway/src/ggui/render.js`, `apps/client/App.js` | `.omo/ulw-loop/evidence/G004-C003-inline-ggui-browser.png`, `.omo/ulw-loop/evidence/G006-C003-responsive-browser.png` |
| Hook safety | Hook failures are diagnostics, not turn crashes. | `services/agent-gateway/src/engine/hooks.js`, `src/index.js` | `services/agent-gateway/test/http.test.js`, `.omo/ulw-loop/evidence/G005-C002-hook-failure-runtime.txt` |
| Self-improvement candidates | Prompt, skill, hook, workflow/node spec changes are staged as versioned candidates. | `services/agent-gateway/src/self-improvement.js`, `src/workflows/candidate-node-handlers.js` | `services/agent-gateway/test/workflow-evolution-candidates.test.js`, `.omo/ulw-loop/evidence/G005-C001-self-improvement-candidates.txt` |
| Voice input | Browser microphone audio is transcribed through `whisper.cpp` adapter contract. | `apps/client/App.js`, `services/agent-gateway/src/voice/whisper.js` | `.omo/ulw-loop/evidence/G006-C001-voice-browser.png`, `services/agent-gateway/test/http.test.js` |

## Required Runtime Invariants

- Main and EXAONE must continue to share the same profiled engine entrypoint.
- EXAONE request construction must omit `tools`, `tool_choice`, `parallel_tool_calls`, `functions`, and `function_call`.
- Compaction threshold defaults to `0.9`.
- ggui surfaces render inside assistant answer bubbles, not as a separate bottom panel.
- Self-improvement is internal and not user-visible in normal chat UI.
- Hook and isolated implementer failures are returned as diagnostic metadata and must not crash `/turn`.
