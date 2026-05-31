# Self-Evolution Loop

## 목표

에이전트가 "나를 이렇게 바꿔줘"라는 요청을 받았을 때, 메인 에이전트 API의 프롬프트/툴/워크플로우 상태, EXAONE expression system prompt, 온톨로지/메모리 역할의 local workflow YAML을 함께 수정 후보로 만들고, 오류가 없을 때만 active 상태로 승격한다.

이 루프의 중심은 skill을 더 붙이는 것이 아니라 **연상법(recall policy)을 스스로 바꾸는 것**이다. OBA는 자신의 작업 경험, 실패 이력, 사용자 피드백을 보고 "무엇을 할 수 있는가"뿐 아니라 "같은 말을 들었을 때 무엇을 먼저 떠올리는가"를 갱신한다.

## 루프 상태

- active: 현재 메인 에이전트 API가 사용하는 안정 프롬프트/툴/워크플로우 상태, EXAONE expression prompt, 발행된 local workflow 버전
- candidate: 에이전트가 제안한 다음 recall policy patch, 로컬 patch, local workflow YAML patch
- validating: candidate 검증 중
- published: candidate가 active로 승격됨
- rejected: candidate가 실패해 폐기됨

## 검증 게이트

1. YAML parse
2. 로컬 prompt/tool/workflow patch parse
3. recall policy patch parse
4. local workflow runtime/워크플로우 필수 필드 존재
5. 참조 도구 존재 여부
6. 프롬프트 안전 경계 보존
7. EXAONE expression prompt가 사실 판단/툴 실행 권한을 갖지 않는지 확인
8. 샘플 입력 smoke run
9. 같은 키워드가 상황별로 다르게 회상되는지 recall smoke run
10. 발행 전 diff summary 생성
11. hook 후보는 `failurePolicy: diagnostic`을 유지하며, 실패해도 `/turn`을 중단하지 않는지 검증

## 불변 규칙

아래 규칙은 에이전트가 자기수정으로 제거하거나 약화할 수 없다.

- 외부 결제/주문/예약 확정은 사용자 확인이 필요하다.
- API 키, 토큰, 비밀번호는 프롬프트/YAML 본문에 쓰지 않는다.
- candidate 검증 실패 시 active를 바꾸지 않는다.
- 배포 시 버전명과 변경 이유를 남긴다.
- 자기수정 요청이 모호하면 먼저 작게 바꾸고, 사용자의 다음 반응으로 확장한다.
- local workflow agent를 메인 에이전트로 사용하지 않는다. local workflow는 메인 에이전트 API가 호출하는 stateless 지식/가공 도구다.
- EXAONE expression prompt는 사용자와의 소통 방식을 고칠 수 있지만, 사실 판단, 도구 실행, 안전 경계의 최종 결정을 대신할 수 없다.
- skill/workflow 변경만으로 문제를 덮지 않는다. 회상 실패가 원인이면 recall policy 후보를 반드시 만든다.
- Codex 구현자는 runtime engine이 아니다. 자기개선 candidate 구현이 필요할 때만 별도 isolated implementer로 쓰고, 사용자 대화에는 노출하지 않는다.
- hook 내부 오류는 diagnostic metadata로 남겨 다음 자기개선 후보가 고칠 수 있게 한다.

## 데모용 자기수정 예시

요청:

```text
앞으로 내가 뭐 사고 싶다고 하면 바로 추천하지 말고, 후보 비교표를 먼저 띄우고 나한테 확인받게 바꿔줘.
```

에이전트 변경:

- "구매"라는 단어를 곧장 추천/실행으로 떠올리지 않고 비교/확인 관점으로 먼저 떠올리도록 recall policy 수정
- 로컬 system prompt에 구매/주문 intent 처리 규칙 추가
- EXAONE expression prompt에 구매 후보를 차분히 설명하고 확인을 구하는 발화 규칙 추가
- ApiFuse 후보 API 탐색 단계를 유지
- ggui 비교표 UI 렌더 단계를 추가
- 확인 전 실행 금지 규칙 추가
- local workflow YAML에 구매 요청 처리 정책과 workflow metadata 추가
- smoke case 추가:
  - 입력: "노이즈캔슬링 이어폰 사고 싶어"
  - 기대: 후보 비교 UI 표시, 구매 확정 실행 없음

## 저장할 메타데이터

```json
{
  "versionName": "purchase-confirmation-ui-v1",
  "reason": "사용자가 구매 요청 전에 비교표와 확인 단계를 원함",
  "changed": ["local_prompt", "exaone_expression_prompt", "local_workflow_registry", "local_workflow_memory", "ggui_render_step"],
  "tests": ["yaml_parse", "purchase_smoke_case"],
  "rollback": "previous_published_version_id"
}
```
