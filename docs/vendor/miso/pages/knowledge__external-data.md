---
title: "외부 데이터 연동하기"
source: "https://console.miso.gs/learn/knowledge/external-data"
synced_at: "2026-05-30"
nav_title: "외부 데이터 연동하기"
---

# 외부 데이터 연동하기

Source: https://console.miso.gs/learn/knowledge/external-data

## Outline

- h1: 외부 데이터 연동하기
  - h2: 테스트 환경
  - h2: 외부 데이터 연동 API 명세
    - h3: Endpoint
    - h3: Header
    - h3: Request Body Elements
    - h3: Request Syntax
    - h3: Response Elements
    - h3: Response Syntax
    - h3: Errors
      - h4: HTTP Status Codes
  - h2: 적용하기

## Content

MISO 사용자 매뉴얼
>
지식
>
외부 데이터 연동하기
외부 데이터 연동하기
테스트 환경
예제코드
https://github.com/mir-makeitreal/mir-tutorials/tree/main/examples/external-knowledgebase
예제코드 실행한 테스트 서버 (Swagger): https://mir-external-knowledgebase.vercel.app/apidocs
Bearer token 인증 없이 구현한 서버입니다.
외부 데이터 연동 API 명세

다음 API를 구현하면 미소 앱이 날리지 리트리버로서 호출해서 사용할 수 있습니다.

Endpoint
POST <your-endpoint>/retrieval

Header

이 API는 MISO와 독립적인 Knowledge retriever와 연결하는 데 사용됩니다. 인증은 Authorization HTTP 헤더의 API-Key를 사용합니다. 인증 로직은 API 개발자가 직접 구현합니다.

Authorization: Bearer {API_KEY}

Request Body Elements
Property	Required	Type	Description	Example value
knowledge_id	TRUE	string	날리지 고유 ID	AAA-BBB-CCC
query	TRUE	string	사용자의 쿼리	What is GenAI?
retrieval_setting	TRUE	object	파라미터	하단 참고

retrieval_setting 프로퍼티는 아래의 키들로 구성된 객체입니다:

Property	Required	Type	Description	Example value
top_k	TRUE	int	최대 검색결과 수	5
score_threshold	TRUE	float	검색결과를 반환하기 위한 최소 점수 (0.0~1.0 범위)	0.5
Request Syntax
POST <your-endpoint>/retrieval HTTP/1.1
-- header
Content-Type: application/json
Authorization: Bearer your-api-key
-- data
{
    "knowledge_id": "your-knowledge-id",
    "query": "your question",
    "retrieval_setting":{
        "top_k": 2,
        "score_threshold": 0.5
    }
}

Response Elements

요청한 작업이 성공하면 서비스에서 HTTP 200 응답을 보냅니다.

서비스에서 반환되는 데이터는 JSON 형식으로 다음과 같습니다.

Property	Required	Type	Description	Example value
records	TRUE	List[Object]	Knowledgebase를 쿼리하여 얻은 레코드 목록입니다.	하단 참고

records 프로퍼티는 아래의 키들로 구성된 객체 배열입니다:

Property	Required	Type	Description	Example value
content	TRUE	string	Knowledgebase에 있는 데이터 소스의 텍스트 덩어리를 포함합니다.	MISO:The Innovation Engine for GenAI Applications
score	TRUE	float	query와 record 간 관련성 점수입니다. (0.0~1.0 범위)	0.5
title	TRUE	string	문서 제목	MISO Introduction
metadata	FALSE	json	메타데이터 속성과 해당 값을 포함합니다. 형식은 자유입니다.	하단 예시 참고
Response Syntax
{
  "records": [
    {
      "content": "어린 왕자가 떠나온 별이 소행성 B612호라고 믿는 데는 그럴 만한 근거가 있다. 이 소행성을 1909년 딱 한 번 터키 천문학자가 망원경으로 관측한 적이 있다.그래서 그는 국제 천문학 대회에서 자신의 발견을 성대히 증명해 냈다. 그러나 그가 입은 옷 때문에 아무도 그를 믿지 않았다. 어른은 언제나 그렇다.다행히도 소행성 B612호의 명성을 위해 터키의 독재자는 백성에게 서구 의상을 입지 않으면 사형에 처하겠다고 으름장을 놓았다. 그 천문학자는 1920년 매우 세련된 의상을 차려입고 다시 증명했다. 그러자 이번에는 모두 그의 견해를 받아들였다.",
      "metadata": {
        "dataset_id": "dataset-0000",
        "dataset_name": "Classic Literature",
        "document_name": "The Little Prince.pdf",
        "document_summary": "A poetic tale about a pilot stranded in the desert who meets a young prince visiting Earth from a tiny asteroid.",
        "document_url": "https://example.com/books/little-prince",
        "page": 11
      },
      "score": 0.98,
      "title": "The Little Prince.pdf"
    },
    {
      "content": "앨리스는 곧장 다시 말하기 시작했다. \"내가 지구를 곧장 뚫고 지나가는 건지도 모르겠어! 머리를 아래로 향하고 걷는 사람들 사이에 내가 불쑥 나타나면 얼마나 우스꽝스러워 보일까! 반감자들이겠지.\"(앨리스는 이번엔 듣고 있는 사람이 아무도 없어서 다행이라고 생각했다. 적절한 단어같지 않았으니까.) \"하지만, 그 곳이 어느 나라인지는 물어봐야 할 거야. 실례합니다, 아주머니, 여기가 뉴질랜드인가요? 아니면 오스트레일리아인가요?\"(이렇게 말하면서 앨리스는 무릎을 굽혀 예의바르게 인사하려고 했다. 떨어지는 와중에도 허공에서 무릎을 굽히는 멋들어진 인사라니! 당신이라면 그렇게 할 수 있을까?) \"그러면 나를 얼마나 무식한 여자애라고 생각하겠어. 아니지, 절대 물어보지 않을거야. 아마 나라 이름이 적혀 있는 곳은 없는지 찾아봐야겠네.\"",
      "metadata": {
        "dataset_id": "dataset-0000",
        "dataset_name": "Classic Literature",
        "document_name": "Alice in Wonderland.pdf",
        "document_summary": "A whimsical story about a young girl who falls down a rabbit hole into a fantasy world.",
        "document_url": "https://example.com/books/alice",
        "page": 23
      },
      "score": 0.55,
      "title": "Alice in Wonderland.pdf"
    }
  ]
}

Errors

작업이 실패하면 서비스는 다음 오류 정보를 JSON 형식으로 다시 전송합니다:

Property	Required	Type	Description	Example value
error_code	TRUE	int	에러 코드	1001
error_msg	TRUE	string	에러에 대한 설명	Invalid Authorization header format. Expected 'Bearer ' format.

error_code 프로퍼티의 타입은 다음과 같습니다:

Code	Description
1001	유효하지 않은 Authorization header 형식
1002	인증 실패
2001	knowledge가 존재하지 않음
HTTP Status Codes

AccessDeniedException 액세스 권한이 누락되어 요청이 거부되었습니다. 권한을 확인하고 요청을 다시 시도하세요. HTTP 상태 코드: 403

InternalServerException 내부 서버 오류가 발생했습니다. 요청을 다시 시도하세요. HTTP 상태 코드: 500

적용하기
지식 관리 메뉴

상단 메뉴 바에서 "지식 관리" 메뉴를 클릭하여 이동합니다.

지식 추가하기

지식 관리 화면에서 "+ 지식 추가하기" → "외부 데이터 API에 연결하기"를 클릭합니다.

외부 데이터 API 연결 선택

"외부 데이터 API 관리" 버튼을 클릭합니다.

API 관리 화면

"추가" 버튼을 클릭합니다.

API 설정 입력

입력 필드 이름, API Endpoint, API Key를 입력합니다.

이 예제에서는 API Key가 없는 API를 활용하므로 의미 없는 텍스트("....")를 입력하였습니다.

외부 데이터 정보 입력

외부 데이터 이름, 데이터 설명, 외부 데이터 ID를 입력하고 연결하면 완료됩니다.

연결 확인

새로운 지식이 추가됨을 확인할 수 있습니다.

외부 데이터 검색 활용

위와 같이 미소 앱에서 해당 데이터를 사용해서 검색이 가능합니다.

Previous

지식 구성하기

Next

태그 입력을 통한 지식 검색 필터링

Last updated 26-0401-1500
