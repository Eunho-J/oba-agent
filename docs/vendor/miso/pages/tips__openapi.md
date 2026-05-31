---
title: "공공데이터 오픈API 활용"
source: "https://console.miso.gs/learn/tips/openapi"
synced_at: "2026-05-30"
nav_title: "공공데이터 오픈API 활용"
---

# 공공데이터 오픈API 활용

Source: https://console.miso.gs/learn/tips/openapi

## Outline

- h1: 공공데이터 오픈API 활용
  - h2: 공공데이터 오픈API 알아보기
    - h3: 공공데이터 오픈API란?
    - h3: 공공 API로 무엇을 할 수 있나요?
  - h2: MISO에서 활용하기
    - h3: 공공API 활용 신청하기
    - h3: MISO에서 연동하기
  - h2: 더 잘 활용하기
    - h3: API 응답 후처리하기
    - h3: 요청변수(params)를 동적으로 입력하기

## Content

MISO 사용자 매뉴얼
>
미소 활용법
>
공공데이터 오픈API 활용
공공데이터 오픈API 활용
공공데이터 오픈API 알아보기
공공데이터 오픈API란?

공공데이터 오픈API는 정부·공공기관이 보유한 데이터를 "바로 조회할 수 있도록 제공하는 공식 API"입니다. 정해진 요청 방식(URL, 파라미터, 인증키 등)으로 호출하면, 최신 데이터를 JSON/XML 형태로 받을 수 있습니다.

공공데이터 오픈API

대표적인 공공·준공공 데이터 예시:

날씨·기온·강수량, 미세먼지·대기질 등 환경 데이터
지역 코드, 행정구역, 공휴일 등 행정·기준 정보
교통·물류 정보(버스·지하철·도로·항만 등)
전력 수요·공급, 실시간 계통 한계 가격(SMP) 등 에너지 계통 데이터
LNG 단가, 유가, 환율 등 기업 운영·원가 계산에 활용되는 경제 지표
공공 API로 무엇을 할 수 있나요?

공공 API를 활용하면, "LLM이 최신 사실 데이터를 기반으로 판단하고 답변할 수 있으며, 이를 실제 업무·운영 시나리오에 바로 적용"할 수 있습니다.

에너지·산업 분야: 기상·재난 데이터로 발전 효율 저하, 설비 점검 필요 여부, 비상 대응 가이드를 자동 안내
유통·매장 운영: 날씨·대기질·공휴일 정보를 활용해 상품 수요 예측, 근무 일정 계산, 매장 대응 메시지 생성
공통 활용: "지금 상황 기준으로 무엇을 해야 하나?"와 같은 질문에 즉시 요약·보고 자동화
MISO에서 활용하기
공공API 활용 신청하기
공공데이터포털에 접속하여 필요한 공공 API를 검색합니다.
공공데이터포털 검색

검색 시, 두 가지 유형의 결과를 확인할 수 있습니다:

파일데이터: 파일 형태의 공공데이터로 MISO의 지식, 외부 데이터베이스에 업로드하거나 파일 입력으로 활용할 수 있습니다.
오픈API: API 형태로 제공하는 데이터입니다. MISO에서는 코드 노드 혹은 API 요청 노드로 활용할 수 있습니다.

활용하고자 하는 API를 클릭합니다.

API 선택
API 이름 우측의 활용신청 버튼을 클릭합니다.
활용 신청
신청서 작성 후 하단의 활용 신청 버튼을 클릭합니다. (대부분 신청 즉시 승인됨)
신청서 작성
이제 확인해야 하는 정보는 나의 인증키(서비스키)와 API 요청변수(파라미터) 2가지입니다.
나의 인증 키: 우측 상단 마이페이지 - 개인 API인증키 - 인증키복사(Decoding) 클릭 후 복사
인증키 복사
API 요청변수(파라미터)
해당 API의 페이지에서 상세기능 - 목록 - 원하는 API 항목 선택 - 조회를 클릭합니다. 클릭 시, API 요청 시 포함해야 하는 변수들과 샘플데이터가 나타납니다.
API 요청변수
MISO에서 연동하기

MISO에서 워크플로우 혹은 챗플로우를 생성합니다. (본 예제에서는 워크플로우로 진행)

앱 조건 설정 - 실행 조건 설정에서 ServiceKey 변수를 Secret으로 추가하고 공공데이터포탈 - 마이페이지에서 복사한 나의 인증키를 붙여넣습니다.

ServiceKey 설정

경고: ServiceKey를 직접 입력해도 동작은 하지만, 인증키가 노출될 수 있으므로 위와 같이 "실행 조건(환경 변수, Secret)으로 설정하는 것을 권장"합니다.

시작 노드 다음으로 API 요청 노드를 추가합니다.
API 요청 노드 추가
추가된 API 요청 노드를 클릭 후 아래 화면과 같이 공공데이터포탈에서 가이드된 요소를 기입합니다.
API: GET으로 설정 후 요청 주소를 붙여넣기
API GET 설정
Params: 우측의 추가 버튼을 클릭하여 공공데이터포탈에서 확인한 모든 항목을 추가합니다.
Params 추가
Params(ServiceKey): 서비스키는 실행조건(환경변수)로 추가했기 때문에 /를 입력하여 변수로 지정합니다.
ServiceKey 변수 지정
Params(나머지): 모든 요소를 추가합니다. 샘플데이터로 테스트 후 가이드를 보며 본인에게 맞는 데이터를 입력합니다.
나머지 Params
종료 블럭을 추가 후 테스트합니다.
테스트 결과
더 잘 활용하기
API 응답 후처리하기

위 예제에서 성공 시 받는 데이터(body)는 아래와 같습니다.

"body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<response><header><resultCode>00</resultCode><resultMsg>NORMAL_SERVICE</resultMsg></header><body><dataType>XML</dataType><items><item><baseDate>20260114</baseDate><baseTime>0600</baseTime><category>PTY</category><nx>55</nx><ny>127</ny><obsrValue>0</obsrValue></item><item><baseDate>20260114</baseDate><baseTime>0600</baseTime><category>REH</category><nx>55</nx><ny>127</ny><obsrValue>83</obsrValue></item><item><baseDate>20260114</baseDate><baseTime>0600</baseTime><category>RN1</category><nx>55</nx><ny>127</ny><obsrValue>0</obsrValue></item><item><baseDate>20260114</baseDate><baseTime>0600</baseTime><category>T1H</category><nx>55</nx><ny>127</ny><obsrValue>-11</obsrValue></item><item><baseDate>20260114</baseDate><baseTime>0600</baseTime><category>UUU</category><nx>55</nx><ny>127</ny><obsrValue>-0.2</obsrValue></item><item><baseDate>20260114</baseDate><baseTime>0600</baseTime><category>VEC</category><nx>55</nx><ny>127</ny><obsrValue>37</obsrValue></item><item><baseDate>20260114</baseDate><baseTime>0600</baseTime><category>VVV</category><nx>55</nx><ny>127</ny><obsrValue>-0.3</obsrValue></item><item><baseDate>20260114</baseDate><baseTime>0600</baseTime><category>WSD</category><nx>55</nx><ny>127</ny><obsrValue>0.5</obsrValue></item></items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>8</totalCount></body></response>\r\n"


알 수 없는 변수들로 가득해, 일반 사용자가 이 데이터를 보고 즉시 "오늘은 좀 춥네"라고 이해하기는 어렵습니다. 하지만 위 데이터는 실제로 아래와 같은 의미를 담고 있습니다.

시간:20260114_0600, 위치:서울(55,127)
기온:-11°C, 습도:83%, 강수:없음(0), 강수량:0mm, 풍속:0.5m/s, 풍향:북동(37°), 동서풍:-0.2, 남북풍:-0.3


원본 데이터를 그대로 LLM에 전달하면 불필요한 토큰 사용으로 비용이 증가하고, 각 데이터 요소가 무엇을 의미하는지 설명하는 프롬프트까지 추가해야 합니다. 또한 위 예제보다 더 복잡하고 항목 수가 많은 데이터의 경우, LLM이 이를 정확히 해석하지 못해 할루시네이션이 발생할 가능성도 높아집니다.

이러한 문제를 방지하려면, "데이터를 먼저 받아 필요한 정보만 남기는 가공 과정"이 필요합니다. 이를 위해 "코드 노드"를 활용합니다.

아래는 "개발 경험이 없는 사용자도 그대로 따라 할 수 있는 코드 블록 활용 방법"입니다.

MISO AI, ChatGPT, Gemini와 같은 LLM 서비스에 접속합니다.
아래에 제공된 프롬프트를 복사하여 입력창에 붙여넣습니다.
프롬프트 내의 **[입력 데이터]**와 [출력 데이터] 부분은, 본인의 워크플로우에서 사용하는 데이터 형식과 목적에 맞게 수정하여 입력합니다.
[역할]
너는 Python 3 코드를 실행 환경 및 보안 표준에 맞춰 최적화하여 작성하는 개발 전문가야.

[작업 지시]
1. 아래 제공된 [입력 데이터]가 XML, JSON, CSV 중 어떤 형식인지 판단해.
2. 해당 형식에 맞는 파싱 로직을 작성하되, **보안 취약점(Bandit B314, B318, B320 등)을 방지**하기 위해 다음 규칙을 반드시 준수해.
   - **XML 파싱 시**: `xml.etree.ElementTree`나 `xml.dom.minidom` 등 표준 라이브러리는 XXE 공격에 취약하므로 사용하지 말 것. 별도의 보안 라이브러리(defusedxml)가 없다면 `re`(정규표현식)를 사용하여 안전하게 데이터를 추출할 것.
   - **JSON/CSV 파싱 시**: Python 표준 라이브러리를 사용하되 최적화된 로직을 작성할 것.
3. 반드시 def main(arg1: str) -> dict: 형식을 유지하고, 출력은 {"result": "가공된 문자열"} 형태여야 함.
4. 코드 내 주석, 설명, 실행 예제는 절대 포함하지 말고 '순수 코드'만 출력할 것.

[입력 데이터]
{입력 데이터}

[출력 데이터]
{출력 형식}

<output_example>
import re

def main(arg1: str) -> dict:
    # 1. 정규표현식 등을 활용한 보안상 안전한 파싱 로직 작성
    # 2. 데이터를 추출하여 [출력 데이터] 형식으로 문자열 생성
    result_str = "가공된 데이터 결과"
    return {"result": result_str}
</output_example>

위 지침에 따라 보안 취약점이 제거된 최적화된 Python 코드를 작성해줘.

생성된 코드를 복사하여 코드블럭에 붙여넣습니다. 입력변수와 출력변수가 코드와 동일하도록 설정해야 합니다.
테스트를 실행하면 깔끔하게 변환된 출력을 볼 수 있습니다.
코드 노드 테스트 결과
요청변수(params)를 동적으로 입력하기

앞선 기본 예제에서는 오늘 날짜를 직접 입력했습니다. 이번에는 "현재 시간 도구"를 활용하여, 오늘 날짜가 "자동으로 입력되도록" 개선해보겠습니다.

도구 - 현재 시간을 API 요청 노드 앞에 추가 후 아래와 같이 설정합니다. (형식: %Y%m%d)
현재 시간 도구
API의 파라미터 설정에서 base_date를 /를 통해 현재시간의 출력 변수로 지정합니다.
동적 날짜 설정

정보: 위 예시처럼 날짜뿐만 아니라 검색어 등 다양한 값을 동적으로 파라미터로 설정하면, 더 자동화된 미소 앱을 만들 수 있습니다. 또한 해당 워크플로우를 "도구로 등록해 에이전트 앱에서 활용하면", 에이전트가 상황에 맞게 공공 API를 자동으로 호출하도록 구성할 수도 있습니다.

Previous

[참고] Google Sheet 키 발급

Next

페르소나 기법

Last updated 26-0401-1500
