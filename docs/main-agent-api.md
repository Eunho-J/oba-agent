# Main Agent API

## 결정

메인 에이전트는 local workflow agent로 만들지 않고, 기존 `chat-server` 구현체도 가져오지 않는다. OBA v1은 `services/agent-gateway` 안에 들어 있는 직접 구현 agent engine이다.

목표는 **한 shared engine을 profile 설정으로 재사용**하는 것이다. `main-agent`는 tools/MCP/ggui/self-improvement signals를 켜고, `exaone-agent`는 같은 engine entrypoint를 쓰되 tools/MCP/ggui tool specs를 요청에 넣지 않는다.

## Public Contract

### `POST /turn`

v1의 유일한 public client-facing endpoint다. 기존 intent router/fallback path는 `/turn` 뒤에 남기지 않는다.

요청:

```json
{
  "message": "이 파일 읽고 요약해줘",
  "conversationId": "demo",
  "toolMode": "enabled",
  "metadata": {}
}
```

규칙:

- `message`는 필수 non-empty string이다.
- `toolMode`는 `enabled` 또는 `disabled`다.
- `transcript`, `audioText`, `turn.transcript`는 `VALIDATION_ERROR`로 거부한다.
- `POST /agent/turn`은 test/dev 설정에서만 켤 수 있는 내부 alias이며, 기본 서버에서는 노출하지 않는다.

응답:

```json
{
  "ok": true,
  "turnId": "turn_...",
  "traceId": "trace_...",
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
  },
  "surface": {
    "kind": "comparisonTable"
  },
  "metadata": {
    "mainAgentAnswer": "...",
    "finalAnswerProvider": "lmstudio-exaone",
    "debug": {
      "mainAgent": {},
      "exaone": {},
      "hooks": [],
      "selfImprovement": {}
    }
  }
}
```

실패 응답에는 `error.code`, `error.message`, `error.stack`을 포함한다.

## Provider

v1 provider는 Codex OAuth 테스트베드인 외부 로컬 `codex-as-api` HTTP 서버다.
TODO: future OpenAI API-compatible provider support should remain a drop-in swap at the provider boundary, without changing agent runtime semantics.

- OBA는 OAuth를 직접 구현하거나 token을 읽지 않는다.
- `codex-as-api`는 별도 프로세스로 실행한다.
- 기본 base URL은 `http://127.0.0.1:18080/v1`이다.
- 모든 provider request는 `model: OBA_PROVIDER_MODEL`을 포함한다.
- v1 provider call은 non-streaming chat completions만 사용한다.
- provider 실패 시 다른 provider로 조용히 fallback하지 않는다.

```bash
codex login
npx codex-as-api
```

## Built-In Tools

기본 built-in tool은 정확히 네 개다.

- `read`: workspace root 안의 UTF-8 파일 읽기
- `write`: workspace root 안의 파일 생성/덮어쓰기
- `edit`: exact text replacement
- `bash`: workspace root cwd에서 trusted local bash-compatible shell command 실행

`bash`는 OS sandbox가 아니다. v1은 `cwd`, timeout, 환경변수 shape, redaction, structured result/error만 보장한다. `write/edit/bash`는 private/local 환경을 전제로 한다.

## MCP

v1 MCP는 streamable HTTP만 지원한다.

- dependency: `@modelcontextprotocol/sdk@1.29.0`
- MCP tool 이름은 기본적으로 `serverId.toolName`
- `enabledTools`와 `toolPolicies`를 통과한 tool만 registry에 들어간다.
- policy 없는 MCP tool은 `high-risk-write`로 보고 노출하지 않는다.
- MCP 실패는 provider 실패가 아니라 capability/tool 실패로 분류한다.
- `OBA_MCP_SERVERS_JSON`으로 설정된 MCP 서버는 `/turn` provider request 전에 discovery되어 같은 registry에 등록된다.

## Runtime Loop

1. `/turn` 요청을 검증한다.
2. profile registry에서 `main-agent`와 `exaone-agent` capability를 읽는다.
3. conversation memory를 불러오고, configured context window의 90% threshold를 넘으면 pre-turn compaction을 수행한다.
4. `main-agent` provider request에는 profile이 허용한 tool specs와 MCP-discovered tools만 넣는다.
5. tool call이 있으면 registry에서 실행하고 같은 turn 안에 tool result를 다시 넣는다. ggui tool result는 assistant answer bubble 안에 붙는 inline surface로 보존한다.
6. mid-turn token pressure가 threshold를 넘으면 transient provider/tool messages를 compact한다.
7. final answer의 완료 주장은 same-turn successful tool event로 claim check한다.
8. EXAONE final answer step은 같은 profiled engine entrypoint를 쓰되 LM Studio route로 실행하고 tool-related request fields를 만들지 않는다.
9. hook failure와 Codex implementer availability failure는 `metadata.debug`의 diagnostic으로 남기며 `/turn`을 crash시키지 않는다.
10. structured JSON log에 trace/span, prompt version, tool schema version, context/debug, failure code를 남긴다.

## Runtime Boundaries

- Codex app-server는 `/turn`에서 제외한다. 자기개선 구현이 필요할 때만 별도 isolated implementer/self-improvement infrastructure로 호출될 수 있다.
- EXAONE profile은 tool specs, MCP discovery, ggui execution을 받지 않는다.
- Voice는 browser microphone recording에서 multipart audio를 보내며, normal UX에서 file picker를 열지 않는다.
