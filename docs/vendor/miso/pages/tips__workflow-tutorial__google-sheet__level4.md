---
title: "[레벨 4] 더 효율적으로 Google Sheet에 데이터 추가하기"
source: "https://console.miso.gs/learn/tips/workflow-tutorial/google-sheet/level4"
synced_at: "2026-05-30"
nav_title: "[레벨 4] 더 효율적으로 데이터 추가"
---

# [레벨 4] 더 효율적으로 Google Sheet에 데이터 추가하기

Source: https://console.miso.gs/learn/tips/workflow-tutorial/google-sheet/level4

## Outline

- h1: [레벨 4] 더 효율적으로 Google Sheet에 데이터 추가하기
  - h2: 생각해보기
  - h2: 코드 노드
    - h3: 반복(Iteration) 노드의 역할: 결과를 모아주는 것
    - h3: 코드 노드가 필요한 이유
    - h3: STEP 1. 반복 내부 코드 노드 구성하기
    - h3: STEP 2. 반복 노드 설정하기
    - h3: STEP 3. 반복 외부 코드 노드 구성하기
  - h2: Google Sheet 도구 노드
    - h3: STEP 4. values.append 도구 노드 추가하기
    - h3: STEP 5. 종료 노드 설정하기
  - h2: 테스트하기

## Content

MISO 사용자 매뉴얼
>
미소 활용법
>
따라하며 배우는 MISO 워크플로우
>
2. 설문 데이터로 VOC 분석하기
>
[레벨 4] 더 효율적으로 데이터 추가
[레벨 4] 더 효율적으로 Google Sheet에 데이터 추가하기

Google Sheet 도구는 Google 서비스를 API로 호출하여 사용하는 방식입니다. 따라서 각 행마다 도구가 한 번씩 호출되며, 처리해야 할 행이 100개 이상인 경우 이전 예제와 같은 방식으로 실행하면 분당 호출 수 제한(Rate Limit)에 걸릴 가능성이 높습니다.

그렇다면 이러한 상황에서는 어떤 방식으로 처리해야 할까요?

생각해보기

생각보다 간단합니다. 변환된 값들을 모아서 한 번만 append 도구를 호출하면 됩니다.

이를 위해서는 Google Sheet append 도구가 반복문 안에 있으면 안 되고, 반복문 밖에 위치해야 합니다. 반복문에서는 각 행을 변환하여 결과 리스트에 모으고, 모든 처리가 끝난 뒤 그 결과를 한 번에 append 하도록 구성합니다.

즉 도구의 입력값은 다음과 같이 중괄호 안에 여러 행이 포함된 이중 배열 형태가 되어야 한다는 것을 생각해볼 수 있습니다.

[
  ["보통", "와이파이 개선 필요하지만 가성비 좋은 여가활동으로 평가"],
  ["매우만족", "응원단과 관중들의 웅장한 응원으로 매우 만족스러운 관람"],
  ["만족", "직관의 감동을 느꼈지만 편의점 메뉴가 단조로워 아쉬움"],
  ["만족", "맥주와 함께 축구 관람하며 즐거운 경험, 좌석 간격 개선 필요"],
  ["매우만족", "경기장 응원 분위기 좋아서 다음 홈경기도 꼭 오고 싶다는 긍정적 반응"]
]

코드 노드

append 도구를 반복문 밖으로 빼는 것까진 좋은데, 반복문의 결과를 바로 append에 넣을 수는 없습니다. 반복 노드가 결과를 모아주는 방식과, append 도구가 원하는 형태 사이에 차이가 있기 때문입니다.

반복(Iteration) 노드의 역할: 결과를 모아주는 것

반복 노드는 내부에서 처리한 각 회차의 결과를 자동으로 하나의 배열로 모아줍니다.

반복 1회차 결과 → "사과"
반복 2회차 결과 → "바나나"
반복 3회차 결과 → "딸기"

→ 반복 노드의 최종 출력: ["사과", "바나나", "딸기"]


이 array(string) 형태로 "모아주는 기능" 덕분에, 반복이 끝난 뒤에는 모든 결과가 하나의 배열에 담겨 있습니다. 우리는 이것을 활용해서 append 도구가 원하는 이중 배열을 만들어야 합니다.

코드 노드가 필요한 이유

형식 차이 때문에 코드 노드를 반복문 안과 밖에 각각 하나씩 배치해 변환이 필요합니다.

반복문 안: LLM 결과를 문자열로 변환하여 반복 노드가 모을 수 있게 만듭니다.
반복문 밖: 모인 문자열 배열을 append가 요구하는 이중 배열 형태로 변환합니다.
STEP 1. 반복 내부 코드 노드 구성하기
반복문 내의 변수 추출 노드 우측의 [+] 버튼을 클릭하여 코드 노드를 배치합니다.
반복 내부 코드 노드

코드 노드를 아래와 같이 구성합니다.

설명 : 변수 추출기에서 각각 출력된 변수를 하나의 문자열로 묶어서 반환합니다.
입력 변수
satisfaction : 변수 추출 노드의 해당 출력 변수 할당
summary : 변수 추출 노드의 해당 출력 변수 할당
코드
import json

def main(satisfaction, summary):
    return {
        "result": json.dumps(
            [satisfaction, summary],
            ensure_ascii=False
        )
    }

STEP 2. 반복 노드 설정하기

STEP 1에서 추가한 코드 노드의 출력 변수를 반복 노드의 출력 변수로 설정합니다.

반복 노드 출력 설정
STEP 3. 반복 외부 코드 노드 구성하기

반복 노드 밖의 [+] 버튼을 클릭하여 코드 노드를 추가합니다.

코드 노드를 아래와 같이 구성합니다.

설명 : 반복 노드의 출력을 append 도구가 요구하는 형태로 변환합니다.
입력 변수
iteration_output : 반복 노드의 출력 변수 할당
코드
import json

def main(iteration_output):
    # 각 JSON 문자열을 파싱해서 이중 배열로 조립
    result = []
    for item in iteration_output:
        row = json.loads(item)
        result.append(row)

    # append가 기대하는 정확한 형태: [["매우만족","요약1"],["불만","요약2"],...]
    return {"result": json.dumps(result, ensure_ascii=False)}

반복 외부 코드 노드 구성
Google Sheet 도구 노드
STEP 4. values.append 도구 노드 추가하기
코드 노드의 우측 [+] 버튼을 클릭하여 values.append 노드를 추가합니다.
아래와 같이 설정합니다.
spreadsheetId : values.get 도구와 동일
range : analysis!A:B
values : STEP 3에서 추가한 코드 노드의 출력
values.append 설정
STEP 5. 종료 노드 설정하기

종료 노드에서도 변수 할당은 필수가 아닌 선택 사항입니다. 별도의 변수 할당 없이 단순히 연결만 해주셔도 됩니다.

종료 노드
테스트하기

테스트하기를 누르면 처리가 시작되며, Google Sheet로 이동하면 아래와 같이 처리된 항목들이 한번에 추가되는 모습을 확인할 수 있습니다.

테스트 결과

Previous

[레벨 3] Google Sheet에 데이터 추가

Next

[참고] Google Sheet 키 발급

Last updated 26-0401-1500
