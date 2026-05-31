AI SLOP CLEANUP REPORT
======================

Scope: agent gateway v1 engine changes, including services/agent-gateway/src/config.js, services/agent-gateway/src/index.js, services/agent-gateway/src/engine/*, services/agent-gateway/src/mcp/*, services/agent-gateway/src/tools/*, services/agent-gateway/test/*.test.js, README.md, docs/architecture.md, docs/main-agent-api.md, .env.example, package.json, services/agent-gateway/package.json, package-lock.json, .gitignore.

Behavior Lock: npm test --workspace services/agent-gateway passed before and after cleanup review with 37 passing tests and 1 gated codex-as-api integration skip. The final blocker regression also covers malformed JSON, null, primitive, array bodies, and empty/null turn.transcript.

Cleanup Plan: Keep the pass bounded to changed files; inspect fallback-like signals, dead code, needless abstraction, boundary leaks, duplicate test coverage, and stale legacy route assertions; edit only if a concrete smell remains in the v1 execution path.

Fallback Findings: No masking fallback slop in the v1 /turn engine path. Remaining "fallback" matches are either documentation that explicitly rejects silent provider fallback or legacy router code quarantined from the default test/runtime path as services/agent-gateway/test/router.legacy.test.mjs.

UI/Design Findings: N/A.

Passes Completed:
- Fallback-like code resolution gate - passed; no v1 masking fallback path found.
1. Pass 1: Dead code deletion - no additional deletion after legacy router tests were quarantined from default suite.
2. Pass 2: Duplicate removal - no actionable duplication found in the bounded pass.
3. Pass 3: Naming/error handling cleanup - existing stackful provider/tool/MCP/validation errors retained.
4. Pass 4: Test reinforcement - focused tests cover registry, built-ins, MCP discovery/execution, HTTP contract, provider loop, logging, claim checks, and fail-closed request validation.

Quality Gates:
- Regression tests: PASS, npm test --workspace services/agent-gateway.
- Syntax check: PASS, node --check over changed JavaScript source and tests.
- Whitespace: PASS, git diff --check.
- Static/security scan: PASS, npm audit --workspace services/agent-gateway --omit=dev found 0 vulnerabilities.
- Typecheck/Lint: N/A, no configured TypeScript or lint script in package.json.

Changed Files:
- services/agent-gateway/src/index.js - request parsing and validation now convert malformed JSON, non-object JSON bodies, and legacy transcript key presence into 400 VALIDATION_ERROR.
- services/agent-gateway/test/http.test.js - regression coverage for malformed bodies, null/primitive/array JSON, and empty/null turn.transcript before provider execution.

Fallback Review:
- Findings: docs/main-agent-api.md provider fallback prohibition; services/agent-gateway/src/router.js legacy fallbackOrder outside v1 runtime; services/agent-gateway/test/router.legacy.test.mjs quarantined from default suite.
- Classification: documentation/legacy compatibility, not masking fallback slop in the active v1 path.
- Escalation Status: none.

Remaining Risks:
- codex-as-api integration remains gated by OBA_RUN_CODEX_AS_API_TESTS=1 and requires a live local provider process.
