Aggregate objective: Implement the approved profiled direct-engine plan in plans/codex-engine-context-voice.md.

Create exactly these seven execution goals, preserving this order:

1. Codex parity and engine profile foundation. Implement and verify docs/codex-runtime-parity.md plus an AgentProfileRegistry for main-agent and exaone-agent. main-agent enables tools/MCP/ggui/reasoning memory/self-improvement signals. exaone-agent uses the same engine profile schema but disables tools/MCP/ggui execution and uses expression memory plus the emotional model route. No Codex app-server runtime.

2. Context memory, token accounting, compaction, and resource lifecycle. Implement per-conversation memory files with manifest/journal/locks/redaction, context replay, token accounting, compaction threshold 0.9 of max context with pre-turn and mid-turn checks, and TurnResourceManager cancellation/timeout/cleanup/shutdown behavior.

3. Shared profiled engine and main-to-EXAONE orchestration. Refactor /turn so both main-agent and exaone-agent run through one shared profiled engine entrypoint. Main runs first, EXAONE runs second via LM Studio + exaone-4.0-1.2b by default, and model routing is swappable by env/config.

4. Capability gating and dynamic ggui inline attachments. Convert tools, MCP, and ggui into profile-gated capability modules. Main receives allowed tools/MCP/ggui; EXAONE receives no tool specs and no MCP. ggui attachments render inline inside assistant answer bubbles and support multiple dynamic surfaces with provenance/error states.

5. Self-improvement, hook safety, and prompt/skill evolution. Make self-improvement a first-class internal engine subsystem covering skill evolution, hook evolution, workflow/node spec evolution, and both profile system prompts. Codex app-server may only be used as isolated implementer, not runtime. Hook failures become diagnostic evidence and never crash /turn.

6. Browser microphone Voice and Pretext responsive UI. Replace upload-style Voice with microphone getUserMedia/MediaRecorder into whisper.cpp transcription. Improve the chat-first UI using @chenglou/pretext for real text measurement/layout stability, responsive compact layout, debug inspector, and inline ggui.

7. Final docs, real E2E, and quality gate. Update docs/config and run real verification: gateway tests, client check, Expo web export, Browser-plugin E2E, LM Studio EXAONE route, model switching, compaction evidence, profile gating, inline ggui, microphone voice, and resource cleanup. No standalone Playwright.

Each goal must have at least four success criteria: happy path, edge/malformed/adversarial path, regression of neighboring behavior, and real-usage evidence path. Manual QA channels must be HTTP call, tmux, Browser use, or computer use as appropriate. Tests alone are not sufficient evidence.
