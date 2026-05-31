# 제품 기획

## 한 줄

에이전트 자신의 작업 경험과 실패 이력에 따라 같은 기억을 다르게 떠올리는 연상법을 스스로 수정, 검증, 배포하는 자기진화형 개인 에이전트.

## 핵심 방향

이 앱의 본체는 "생활 API 라우터"가 아니다. 본질적인 문제는 **기억을 저장하는 방식이나 일을 처리하는 방식에는 자유도가 있는데, 기억을 떠올리는 방식에는 자유도가 부족하다**는 점이다.

사람은 같은 단어를 들어도 상황에 따라 다른 기억 조각과 관점을 떠올린다. "회의"라는 단어도 오늘은 액션아이템, 회고에서는 갈등 패턴, 발표 준비에서는 요약 자료로 떠오를 수 있다. 게다가 그 연상 방식은 사람마다 다르다. 각자의 경험이 기억을 저장하는 방식뿐 아니라 **기억을 다시 부르는 경로**까지 바꾸기 때문이다.

현재 에이전트 시스템은 온톨로지를 개인화해 저장하더라도, 어떤 일을 하든 비슷한 retrieval 방식으로 기억을 꺼내는 경우가 많다. 일부 에이전트는 skill이나 workflow를 스스로 추가하면서 일하는 방식은 진화시킨다. 하지만 OBA Agent의 핵심은 그보다 안쪽이다. local workflow를 기억/온톨로지 역할로 설계하는 것에서 출발해, 에이전트 자신의 작업 경험, 실패 이력, 사용자 피드백에 따라 **recall policy, 즉 연상법 자체**를 수정하고 검증하고 배포한다.

## 역할 분리

- Expo app: 사람과 에이전트가 만나는 몸. STT adapter 음성 입력, 에이전트 상태, ggui 렌더 화면을 담는다. Web target을 먼저 만들고 Android/iOS로 가져간다.
- STT adapter: 음성을 텍스트로 바꾸는 별도 계층이다. Mac/desktop MVP에서는 `whisper.cpp`의 `small`급 모델을 기본 후보로 두고, Android에서는 배터리/발열을 고려해 같은 contract 뒤에 API STT 또는 서버 STT를 붙일 수 있게 한다. EXAONE 4.0 1.2B는 text-generation 모델로 취급하므로 STT 역할을 맡기지 않는다.
- EXAONE 4.0 1.2B: 한국어 사용자를 위한 소통/감성지능 레이어. 입력에서는 STT가 만든 텍스트를 정리하고, 출력에서는 메인 에이전트의 판단을 사람에게 맞는 말투와 정서로 표현한다. EXAONE system prompt도 API registry에서 수정/검증/진화 가능한 대상으로 둔다.
- Main Agent API: 이 프로젝트 안에서 새로 구현하는 초경량 자체 API 런타임이다. local workflow agent가 아니라 이 자체 API 런타임이 메인 두뇌이며, 판단/계획/툴 실행을 맡는 이성지능이다.
- Gemini 3.5 Flash via OpenRouter: 메인 에이전트 API의 추론 모델 후보. 자기수정 판단, 복잡한 작업 계획, YAML/프롬프트 개선안 생성에 쓴다.
- local workflows: 메인 에이전트가 호출하는 온톨로지/메모리 역할의 워크플로우 계층. local workflow runtime 내부 에이전트를 메인으로 쓰지 않고, ontology/memory workflow 결과를 JSON 또는 답변으로 받아 메인 에이전트 API가 사용한다. 메모리는 EXAONE expression memory와 Main Agent reasoning memory로 분리한다.
- ApiFuse: 사용자가 사고 싶다, 주문하고 싶다, 조회하고 싶다 같은 현실 작업을 할 때 필요한 API를 찾고 연결하는 도구 표면.
- ggui: 에이전트가 모바일 앱 안에서 상황에 맞는 UI를 생성하고 띄우는 화면 표면이자, 사용자가 reference image gallery, comparison table, action confirmation 같은 inline 결과를 검토하는 workbench.

## 메모리와 회상 분리

- memory storage: local workflow YAML 안에 경험, 개념, 관계, workflow metadata를 온톨로지/메모리처럼 구조화한다.
- recall policy: 지금 상황, 사용자 상태, 작업 종류, 에이전트의 과거 작업 경험에 따라 어떤 관점의 기억을 먼저 꺼낼지 결정한다. OBA에서 가장 중요한 자기진화 대상이다.
- EXAONE expression memory: 호칭, 말투, 공감 방식, 사용자가 편하게 느끼는 설명 방식, 번역투 보정 규칙을 저장한다.
- Main Agent reasoning memory: 목표, 실패 패턴, 도구 선호, 워크플로우 선택 기준, 안전 경계를 저장한다.

두 memory는 연결되지만 섞이지 않는다. 표현층의 기억이 도구 실행을 결정하지 않고, 이성층의 기억이 사용자 발화를 번역투로 고정하지 않게 하기 위해서다.

## MVP 데모

1. 사용자가 말한다: "회의 자료 정리해줘."
2. STT adapter가 음성을 텍스트로 바꾼다. Mac/desktop demo는 `whisper.cpp`, 모바일 demo는 adapter contract 뒤의 API/server STT를 우선 고려한다. 이후 EXAONE 소통층이 텍스트와 감정 힌트를 정리해 메인 에이전트 API에 넘긴다.
3. 메인 에이전트 API가 현재 상황을 본다. 오늘 회의 준비인지, 회고인지, 보고서 작성인지에 따라 다른 recall policy를 선택한다.
4. 온톨로지/메모리 역할로 설계한 local workflow에서 같은 "회의" 기억이라도 필요한 관점의 노드와 워크플로우를 우선 회상한다.
5. 필요한 도구 실행, ggui 화면, ApiFuse 호출을 판단한다.
6. EXAONE이 이성적 결과를 사용자의 말투와 감정 상태에 맞는 한국어로 표현한다.
7. 사용자의 수정과 반응은 에이전트의 경험 로그가 되고, 다음 recall policy와 expression memory 후보에 반영된다.
8. 후보가 smoke case와 안전 검증을 통과하면, 다음 턴부터 바뀐 연상법을 active policy로 사용한다.

## 클라이언트 방향

클라이언트는 Expo React Native를 우선한다. Web target에서 ggui workbench를 빠르게 만들고, 같은 React surface를 Android/iOS로 가져간다. Android native 골격은 유지하되, 당장 핵심 구현은 `apps/client`의 Expo 앱으로 옮기는 것이 맞다.

Flutter도 멀티플랫폼에는 강하지만, 이 제품의 위험한 부분은 native UI polish가 아니라 ggui, YAML diff, schema viewer, workflow graph/editor 같은 React/웹 친화적 작업대다. 따라서 React Native/Expo가 더 자연스럽다.

## ggui Workbench 범위

ggui는 단순 결과 카드가 아니다. 다음 inline 결과 표면을 담당해야 한다.

- Reference Image Gallery: 사용자가 요청한 이미지 결과를 출처와 함께 보여준다.
- Comparison Table: 후보를 비교할 수 있게 항목, 가격, 장단점, 출처를 보여준다.
- Action Confirmation: 외부 실행 전 확인/보류 상태를 보여주고, token 없는 실행은 막는다.
- Error/Fallback Surface: gateway가 실패해도 sample/fallback과 오류 상태를 분리해서 보여준다.

## 초기 에이전트 구성

초기 프롬프트는 강한 인격/정책/업무 프리셋을 넣지 않는다. 대신 다음 능력만 명확히 둔다.

- 사용자의 말에서 목표와 불확실성을 구분한다.
- 같은 기억을 상황과 작업 목적에 따라 다르게 떠올린다.
- 에이전트의 반복 작업 경험, 실패 이력, 사용자 피드백을 바탕으로 recall policy 후보를 갱신한다.
- 필요한 도구가 있으면 ApiFuse에서 후보 API를 찾는다.
- UI가 필요하면 ggui에 화면 생성을 요청한다.
- 지식/메모리/온톨로지 처리가 필요하면 local workflow를 stateless 도구처럼 호출해 결과를 받는다.
- 자기 개선 요청이 들어오면 메인 에이전트 API 상태, EXAONE expression prompt, 온톨로지/메모리 역할의 local workflow YAML을 함께 기준으로 변경안을 만든다.
- 변경안은 검증 통과 전에는 배포하지 않는다.
- 실패하면 이전 버전을 유지하고, 실패 이유를 사용자가 이해할 수 있게 말한다.

## 자기수정 루프

1. observe: 사용자의 요청, 실패 로그, 반복 패턴을 본다.
2. diagnose: 프롬프트 문제인지, 워크플로우 문제인지, 도구 연결 문제인지 나눈다.
3. propose: recall policy patch를 중심으로 로컬 prompt/tool/workflow patch, EXAONE expression memory patch, local workflow YAML patch, 변경 이유를 만든다.
4. validate: YAML schema, 필수 노드, 도구 연결, 샘플 입력을 검사한다.
5. publish: 검증 통과 시 로컬 active prompt/workflow registry를 갱신하고, 필요한 local workflow만 새 버전으로 업로드/발행한다.
6. remember: 어떤 변경을 왜 했는지 변경 이력으로 남긴다.

## 해커톤 성공 기준

- Android 또는 Web/desktop에서 STT adapter를 거친 한국어 텍스트가 에이전트 턴으로 들어간다. 초기 데모는 `whisper.cpp`와 API STT를 같은 입력 contract로 교체 가능해야 한다.
- 에이전트가 ggui로 모바일 화면에 맞는 동적 UI와 inline result surface를 띄운다.
- 사용자가 ggui workbench 안에서 비교표, 이미지 갤러리, 확인 화면을 검토할 수 있다.
- ApiFuse MCP를 통해 필요한 API 후보를 탐색한다.
- 같은 키워드라도 상황에 따라 다른 기억 관점을 회상하는 데모를 보여준다.
- 로컬 prompt/workflow 상태와 local workflow YAML을 읽고, 단순 skill 추가가 아니라 recall policy 수정안을 만든다.
- 검증 실패 시 배포하지 않고 이유를 설명한다.
- 검증 성공 시 로컬 active 버전을 전환하고 필요한 local workflow artifact를 발행하는 흐름을 데모한다.

## 안전 경계

- 결제, 주문 확정, 예약 확정 같은 외부 side effect는 사용자의 명시 확인 없이는 실행하지 않는다.
- 자기수정은 candidate 버전을 먼저 만들고, active 버전은 검증 통과 후에만 교체한다.
- API 키와 토큰은 YAML/프롬프트에 직접 쓰지 않는다.
- 에이전트가 자기 프롬프트를 바꿔도 안전 경계와 검증 루프는 바꿀 수 없다.
