# 연동 노트

확인일: 2026-05-30

## local workflow runtime

Chrome에 열린 local workflow runtime 매뉴얼 기준:

제품 경계:

- local workflow agent를 메인 에이전트로 쓰지 않는다.
- local workflow를 메인 에이전트 API가 호출하는 ontology/memory 계층처럼 설계한다.
- 메인 에이전트 API의 툴콜, MCP orchestration, ggui workbench 판단, 장기 대화 컨텍스트는 메인 에이전트 API가 소유한다.

- 음성 설정 문서는 답변 음성 재생과 사용자 음성 인식을 앱 설정에서 제공한다고 설명한다.
- 에이전트/챗워크플로우 API는 `POST https://<your-endpoint>/ext/v1/chat`를 사용한다.
- `/ext/v1/chat` 요청은 `Authorization: Bearer {api_key}`, `inputs`, `query`, `mode`, `conversation_id`, `user`, `files`를 받는다.
- `mode`는 `streaming`과 `blocking`이 있고, 문서상 streaming이 권장된다.
- 워크플로우 API는 `POST https://<your-endpoint>/ext/v1/workflows/run`를 사용한다.
- 앱은 저장 후 발행해야 외부 사용자/API에 최신 상태가 반영된다.
- 해커톤 가이드는 Document MCP 서버 `https://3.36.78.231.sslip.io/mcp`를 `archived-doc-mcp`로 등록하는 흐름을 제안한다.

## Main Agent API

외부 chat-server 구현체는 사용하지 않는다. 이 프로젝트 안에서 필요한 것만 다시 구현한다.

MVP 범위:

- `POST /turn` 중심의 단순 HTTP API
- OpenRouter/Gemini provider adapter
- STT adapter for voice-to-text
- EXAONE text cleanup + expression adapter
- ApiFuse, ggui, local workflow memory/ontology adapter
- 한 턴 안에서만 반복되는 작은 tool loop
- 파일 또는 SQLite 기반 prompt/workflow registry

제외:

- OAuth 기반 chat server
- Redis/BullMQ queue
- DynamoDB persistence
- 복잡한 prompt cache
- 장기 background job orchestration

## STT

결정:

- EXAONE은 STT가 아니라 post-STT expression/text cleanup layer다.
- `whisper.cpp`는 Mac/desktop MVP의 기본 로컬 STT 후보로 둔다.
- Android는 초기부터 로컬 `whisper.cpp`에 묶지 않는다. 모델 다운로드, 배터리, 발열, 실시간성 부담이 있으므로 같은 STT adapter 뒤에서 API STT 또는 서버 STT를 먼저 붙일 수 있게 한다.
- 한국어 품질 기준의 기본 후보는 `small`급이다. `tiny`/`base`는 빠른 smoke test와 짧은 명령용으로 남기고, `medium` 이상은 정확도가 필요할 때 선택한다.

Adapter output 초안:

```json
{
  "text": "회의 자료 정리해줘",
  "language": "ko",
  "confidence": 0.86,
  "segments": [],
  "provider": "whisper.cpp",
  "model": "small"
}
```

## ApiFuse

Chrome에 열린 ApiFuse 문서 기준:

- 모든 오퍼레이션은 `POST https://api.apifuse.com/v1/{providerId}/{operationId}` 형식으로 호출한다.
- 인증은 `Authorization: Bearer YOUR_API_KEY`를 사용한다.
- 커넥션이 필요한 오퍼레이션은 `X-ApiFuse-Connection-Id: af_con_<22-char>` 헤더를 추가한다.
- 전체 OpenAPI 3.1은 `/api/openapi.json`, 문서형 레퍼런스는 `/docs/api`에서 확인한다.
- MCP 엔드포인트는 `https://api.apifuse.com/mcp` 하나이며, Streamable HTTP 클라이언트에 등록한다.
- `apifuse_dev_*` 도구는 API 키 없이 탐색/스키마/가이드 용도로 사용할 수 있다.
- 실제 실행 계열인 `apifuse_execute_tool`, `apifuse_manage_connection`은 ApiFuse API 키가 필요하다.

## OpenRouter

OpenRouter 문서 기준:

- Gemini 3.5 Flash 모델 ID는 `google/gemini-3.5-flash`다.
- Chat Completions 엔드포인트는 `POST https://openrouter.ai/api/v1/chat/completions`다.
- OpenAI SDK 호환 방식으로 `baseURL: https://openrouter.ai/api/v1`를 사용할 수 있다.

## EXAONE

Hugging Face의 LG AI Research 모델 목록 기준:

- 공개 1.2B 후보는 `LGAI-EXAONE/EXAONE-4.0-1.2B`다.
- Gateway는 특정 런타임을 강제하지 않고 OpenAI-compatible local endpoint를 가정한다.
- Hugging Face 모델 카드 기준 EXAONE 4.0 1.2B는 `Text Generation` 모델이며, 예제도 `pipeline("text-generation")`와 chat completions 형태다. 따라서 STT 모델로 가정하지 않는다.
- 이 프로젝트에서 EXAONE은 STT 이후 텍스트 정리와 최종 출력 표현을 맡는다.
- EXAONE expression system prompt는 로컬 registry에서 active/candidate 버전으로 관리한다.
- 초기 seed 경로는 `EXAONE_EXPRESSION_PROMPT_PATH=prompts/exaone-expression.md`다.
- EXAONE은 발화/감성지능이고, Main Agent API는 판단/계획/툴 실행의 이성지능이다.

## ggui

npm registry 기준으로 `0.2.0-alpha.4`가 `alpha` dist-tag에 올라와 있다. 확인한 주요 패키지:

- `@ggui-ai/react`
- `@ggui-ai/react-native`
- `@ggui-ai/protocol`
- `@ggui-ai/agent-server`
- `@ggui-ai/cli`
- `@ggui-ai/design`
- `@ggui-ai/mcp-server`

주의:

- 여러 패키지의 npm `latest` dist-tag는 아직 `0.1.0-rc.1`, `0.2.0-alpha.0`, `0.2.0-alpha.1` 등 이전 버전을 가리킨다.
- 이 프로젝트에서 alpha.4를 쓸 때는 `@alpha` dist-tag 또는 정확한 `@0.2.0-alpha.4` 버전을 사용한다.
- GitHub remote tag 목록은 npm alpha.4 배포와 완전히 일치하지 않을 수 있으므로, 패키지 설치 가능 여부는 npm registry를 기준으로 판단한다.

예:

```bash
npm install @ggui-ai/react@alpha @ggui-ai/react-native@alpha @ggui-ai/protocol@alpha
```
