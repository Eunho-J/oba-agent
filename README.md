# OBA Agent

한국어 음성 기반 자기진화형 개인 에이전트입니다. 핵심 목표는 skill이나 workflow만 늘리는 챗봇이 아니라, 에이전트가 자신의 작업 경험, 실패 이력, 사용자 피드백을 바탕으로 **기억을 떠올리는 연상법(recall policy) 자체를 스스로 수정하고 검증하고 배포하는 에이전트**를 만드는 것입니다.

## MVP

- Android 앱: STT adapter를 통한 한국어 음성 입력, 텍스트 확인, 에이전트 상태, ggui 렌더 화면
- whisper.cpp: Mac/desktop MVP의 기본 로컬 STT 후보. Android는 같은 adapter 뒤에서 API STT 또는 서버 STT로 시작할 수 있게 둔다.
- EXAONE 4.0 1.2B: STT 이후 한국어 텍스트 정리와 최종 발화를 담당하는 감성지능/소통 레이어
- Main Agent API: 새로 구현하는 초경량 API 턴 루프, 최소 프리셋, 자기수정/검증 루프, 도구 사용 판단
- local workflows: YAML import/export 가능한 워크플로우를 온톨로지/메모리 계층처럼 설계해 쓰는 stateless 정보 가공 계층
- Obsidian vault: 최상위/core 문서를 항상 기억해야 하는 내용으로 다루고, 일정 길이 이상이면 publish 전에 split 후보로 분리
- LM Studio/EXAONE nodes: 로컬 EXAONE 4.0 1.2B 인스턴스를 간단한 프롬프트 원칙으로 호출
- ApiFuse MCP: 필요한 현실 API를 탐색하고 연결하는 기본 도구
- ApiFuse guard: 외부 실행은 confirmation token 없이는 실행하지 않는 보호 계층
- ggui surface: 요청에 맞는 모바일/웹 결과 화면을 띄우는 사용자-facing 렌더 표면. workflow runtime node나 자기개선 UI가 아니다.
- Self-evolution: Codex delegation으로 내부 후보를 만들고 검증한다. skills, hooks, system prompt도 진화 대상이지만 사용자에게 노출하지 않는다. Hook 실패는 에이전트를 죽이지 않고 진단 메시지로 남긴다.

## Install

```bash
git clone <repo-url>
cd oba-agent
npm ci
npm --prefix apps/client ci
cp .env.example .env.local
```

Requirements:

- Node.js 20 or newer.
- whisper.cpp CLI for local voice input:

```bash
brew install whisper-cpp
brew install ffmpeg
mkdir -p ~/.cache/whisper.cpp
curl -L -o ~/.cache/whisper.cpp/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

- LM Studio with an OpenAI-compatible local server on `http://127.0.0.1:1234/v1`.
- EXAONE model loaded in LM Studio. The default model id is `exaone-4.0-1.2b`; change `OBA_LLM_MODEL`, `EXAONE_MODEL`, and `OBA_LLM_MODEL_ALLOWLIST` in `.env.local` if your LM Studio model id is different.
- `codex-as-api` for the v1 main provider. Run it separately after `codex login`:

```bash
npx codex-as-api
```

The default gateway config expects:

- main provider: `http://127.0.0.1:18080/v1`
- main provider health: `http://127.0.0.1:18080/health`
- LM Studio / EXAONE: `http://127.0.0.1:1234/v1`
- whisper.cpp binary/model and browser audio conversion: set `OBA_WHISPER_CPP_BIN`, `OBA_WHISPER_CPP_MODEL`, and `OBA_FFMPEG_BIN` in `.env.local`
- gateway: `http://127.0.0.1:8787`
- web client: Expo's printed web URL, usually `http://localhost:8081`

## Run Locally

Start the gateway:

```bash
npm run dev:gateway
```

In another terminal, start the web client:

```bash
npm --prefix apps/client run web
```

Then open the web client and keep the gateway field set to `http://127.0.0.1:8787`.

Quick API check:

```bash
curl -X POST http://localhost:8787/turn \
  -H "Content-Type: application/json" \
  -d '{"message":"이 README 파일 읽고 지금 구조를 요약해줘","conversationId":"demo"}'
```

If `codex-as-api` or LM Studio is not running, health checks and tests still work, but a real `/turn` conversation can fail at the provider step.

## Verify

```bash
npm test
npm run qa:e2e
npm run qa:legacy-runtime-scan
```

`POST /turn` v1은 `message`만 사용자 입력 필드로 받습니다. 예전 `transcript`/`audioText` 입력은 새 엔진 계약과 섞이지 않게 `VALIDATION_ERROR`로 거부합니다.

`npm run qa:e2e`는 로컬 E2E 데모입니다. 회의 기억 recall, Obsidian core memory, ggui reference image gallery / comparison table / action confirmation, ApiFuse guarded purchase, internal-only self-evolution candidate, registry publish/rollback, legacy-runtime scan을 한 번에 검증합니다. Browser 기반 수동 검증은 Codex Browser plugin을 사용하고 standalone Playwright는 사용하지 않습니다.

## Docs

- [제품 기획](docs/product-plan.md)
- [아키텍처](docs/architecture.md)
- [메인 에이전트 API](docs/main-agent-api.md)
- [STT Adapter](docs/stt-adapter.md)
- [Memory Recall Model](docs/memory-recall-model.md)
- [EXAONE Expression Layer](docs/exaone-expression-layer.md)
- [자기수정 루프](docs/self-evolution-loop.md)
- [ggui Result Surface](docs/ggui-workbench.md)
- [클라이언트 플랫폼 전략](docs/client-platform-strategy.md)
- [연동 노트](docs/integration-notes.md)
- [개발 환경](docs/development-setup.md)
- [Prompt Seeds](prompts/README.md)
- [Android 골격](apps/android/README.md)
