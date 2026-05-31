# Memory Recall Model

## 문제정의

기억을 저장하는 방식에는 자유도가 있다. 온톨로지, 벡터 DB, 노트, 워크플로우, 사용자 프로필 등 다양한 저장 방식이 가능하다. 일을 처리하는 방식에도 자유도가 있다. 도구를 붙이고, 워크플로우를 만들고, API를 호출할 수 있다.

하지만 많은 에이전트는 **기억을 떠올리는 방식**에는 자유도가 부족하다.

사람은 같은 단어를 들어도 처한 상황에 따라 다른 기억을 떠올린다.

- "회의" + 오늘 업무: 액션아이템, 참석자, 마감
- "회의" + 회고: 갈등 패턴, 분위기, 반복된 문제
- "회의" + 발표 준비: 핵심 메시지, 슬라이드 재료, 요약 문장

이 차이는 단순 검색 랭킹이 아니다. 사람마다 쌓아온 경험이 다르기 때문에 연상 경로 자체가 다르다. OBA Agent는 이 연상 경로를 제품의 핵심 대상으로 본다.

중요한 차이는 자기진화의 위치다. Hermes 같은 skill 중심 에이전트가 "일하는 방식"을 진화시킨다면, OBA Agent는 **기억을 떠올리는 방식**, 즉 연상법을 진화시킨다. skill은 무엇을 할 수 있는지의 목록이고, recall policy는 지금 어떤 경험을 어떤 관점으로 먼저 불러올지의 방식이다.

## 핵심 가설

개인화 에이전트는 memory storage보다 recall policy를 개인화하고, 나아가 recall policy를 스스로 갱신할 수 있어야 한다.

- storage personalization: 무엇을 저장할지, 어떤 관계로 저장할지
- recall personalization: 지금 상황에서 어떤 관점, 관계, 경험을 먼저 떠올릴지
- recall evolution: 에이전트의 작업 경험, 실패, 반복 상황, 사용자 피드백을 바탕으로 다음에 떠올릴 경로 자체를 수정/검증/배포할지
- expression personalization: 떠올린 결과를 어떤 말투와 감정으로 사용자에게 전달할지

## 분리된 메모리

### Main Agent Reasoning Memory

이성지능이 사용하는 memory다.

- 작업 목표
- 실패 패턴
- 도구 선택 기준
- 사용자별 업무 선호
- 안전 경계
- local workflow-as-memory reference

### EXAONE Expression Memory

감성지능과 발화가 사용하는 memory다.

- 호칭과 말투
- 설명 길이
- 공감 강도
- 사용자가 자연스럽다고 느끼는 한국어 어순
- 번역투 보정 규칙
- ggui 화면 안내 문구 선호

두 memory는 연결되지만 섞이지 않는다. 표현 memory가 작업 결정을 대신하면 위험하고, reasoning memory가 사용자-facing 말투를 고정하면 자연스러운 대화가 깨진다.

## Recall Policy

Recall policy는 다음 입력을 본다.

- 현재 사용자 발화
- 작업 종류
- 시간/상황
- 최근 상호작용
- 실패/수정 이력
- 사용자의 감정 힌트

그리고 다음을 결정한다.

- 어떤 ontology node를 먼저 볼지
- 어떤 memory edge를 우선 탐색할지
- reasoning memory와 expression memory 중 무엇을 호출할지
- local workflow memory를 실행할지, 로컬 도구를 호출할지
- ggui workbench로 사용자에게 편집권을 줄지

## Recall Evolution

Recall evolution은 "새 skill을 추가한다"와 다르다.

- 사용자가 어떤 회상을 틀렸다고 느꼈는지 본다.
- 같은 단어가 어떤 상황에서 다른 의미였는지 기록한다.
- local workflow 안의 ontology edge, workflow metadata, reasoning memory, expression memory 중 무엇을 바꿔야 하는지 나눈다.
- 다음 회상에서 어떤 edge를 먼저 탐색할지 candidate policy를 만든다.
- smoke case와 안전 검증을 통과한 policy만 active로 승격한다.

## 설계 원칙

- 저장과 회상을 분리한다.
- 회상 방식도 versioned candidate로 관리한다.
- 사용자 반응과 수정은 recall policy의 학습 신호가 된다.
- skill/workflow 진화보다 recall policy 진화를 우선 설계 대상으로 둔다.
- EXAONE은 표현 memory를 사용하지만 도구 실행을 결정하지 않는다.
- Main Agent는 reasoning memory를 사용하지만 최종 발화의 말투를 직접 고정하지 않는다.
