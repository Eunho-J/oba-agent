---
title: "에이전트 / 챗워크플로우 API"
source: "https://console.miso.gs/learn/api-guide/agent-chatflow-api"
synced_at: "2026-05-30"
nav_title: "에이전트/챗워크플로우 API"
---

# 에이전트 / 챗워크플로우 API

Source: https://console.miso.gs/learn/api-guide/agent-chatflow-api

## Outline

- h1: 에이전트 / 챗워크플로우 API
  - h2: 채팅 메세지 보내기
    - h3: Request Body
    - h3: Response
    - h3: Errors
  - h2: 답변 생성 중지
    - h3: Path Parameter
    - h3: Request Body
    - h3: Response
  - h2: 다음 추천 질문 가져오기
    - h3: Path Parameter
    - h3: Query Parameters
  - h2: 채팅 메시지 내역 가져오기
    - h3: Query Parameters
    - h3: Response
  - h2: 대화 목록 가져오기
    - h3: Query Parameters
    - h3: Response
  - h2: 대화 삭제하기
    - h3: Path Parameter
    - h3: Request Body
    - h3: Response
  - h2: 대화 이름 변경하기
    - h3: Path Parameter
    - h3: Request Body
    - h3: Response
  - h2: 앱 기본 정보 가져오기
    - h3: Query Parameters
    - h3: Response
  - h2: 앱 파라미터 조회
    - h3: Query Parameters
    - h3: Response
    - h3: Response Example
  - h2: 앱 메타 정보 조회
    - h3: Query Parameters

## Content

MISO 사용자 매뉴얼
>
미소 API 사용법
>
에이전트/챗워크플로우 API
에이전트 / 챗워크플로우 API
채팅 메세지 보내기

POST /chat

curl -X POST 'https://<your-endpoint>/ext/v1/chat' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "inputs": {},
    "query": "What are the specs of the iPhone 13 Pro Max?",
    "mode": "streaming",
    "conversation_id": "",
    "user": "abc-123",
    "files": [
      {
        "type": "image",
        "transfer_method": "remote_url",
        "url": "https://miso.ai/logo/logo-site.png"
      },
      {
        "type": "image",
        "transfer_method": "local_file",
        "upload_file_id": "{uploded-file-id}"
      }
    ]
}'

Request Body
query (string)
사용자의 입력 또는 질문 내용
inputs (object)
앱에서 정의된 변수들의 값을 입력
여러 개의 key/value 쌍으로 구성되며, 각 key는 변수명, value는 해당 값
기본값은 {}
mode (string)
응답 반환 방식
streaming: 스트리밍 모드 (권장) Server-Sent Events(SSE)를 통해 타자기처럼 출력됩니다.
blocking: 블로킹 모드 실행 완료 후 결과를 한 번에 반환
user (string)
최종 사용자 식별자
통계 및 조회용으로 사용되며, 앱 내에서 고유하게 정의되어야 합니다.
conversation_id (string)
이전 대화 내용을 기반으로 이어서 대화를 진행하려면 이전 메시지의 conversation_id를 전달해야 합니다.
files (array[object])
이미지 등 파일을 함께 입력할 때 사용합니다.
모델이 Vision 기능을 지원할 경우에만 사용 가능합니다.
파일 객체 구성:
type (string): 지원 타입 (image만 지원)
transfer_method (string): 전달 방식
remote_url: 이미지 URL
local_file: 파일 업로드 방식
url (string): 이미지 URL (transfer_method가 remote_url일 때 사용)
upload_file_id (string): 업로드된 파일 ID (local_file 방식일 경우, 사전에 업로드된 ID가 필요합니다.)
auto_gen_name (bool)
대화 제목 자동 생성 여부 (기본값: true)
false로 설정하면, 대화 제목을 비동기적으로 생성할 수 있으며 이 경우 대화 이름 변경 API를 호출하고 auto_generate를 true로 설정하면 됩니다.
Response
response_mode가 blocking인 경우에는 CompletionResponse 객체를 반환합니다.
response_mode가 streaming인 경우에는 ChunkCompletionResponse 스트림을 반환합니다.
Errors

채팅 메시지 전송 시 발생할 수 있는 오류 목록입니다.

404, Conversation does not exists
요청한 대화(conversation)를 찾을 수 없습니다.
400, invalid_param
잘못된 파라미터가 입력되었습니다.
400, app_unavailable
앱(App) 설정 정보를 사용할 수 없습니다.
400, provider_not_initialize
사용할 수 있는 모델 인증 정보가 설정되어 있지 않습니다.
400, provider_quota_exceeded
모델 호출 가능 쿼터가 부족합니다.
400, model_currently_not_support
현재 모델을 사용할 수 없습니다.
400, completion_request_error
텍스트 생성 요청에 실패하였습니다.
500, internal_server_error
내부 서버 오류가 발생하였습니다.
답변 생성 중지

POST /chat/:task_id/stop

curl -X POST 'https://<your-endpoint>/ext/v1/chat/:task_id/stop' \
-H 'Authorization: Bearer {api_key}' \
-H 'Content-Type: application/json' \
--data-raw '{"user": "abc-123"}'


응답을 중단하는 API로, 스트리밍 모드에서만 사용 가능합니다.

Path Parameter
task_id (string)
태스크 ID입니다.
스트리밍 청크 응답에서 획득할 수 있습니다.
Request Body
user (string) 필수
최종 사용자 식별자입니다.
초기 메시지 전송 시 사용한 user 값과 동일해야 합니다.
Response
result (string)
항상 "success" 값을 반환합니다.
다음 추천 질문 가져오기

GET /messages/{message_id}/suggest-questions

curl --location --request GET 'https://<your-endpoint>/ext/v1/messages/{message_id}/suggest-questions?user=abc-123' \
--header 'Authorization: Bearer ENTER-YOUR-SECRET-KEY' \
--header 'Content-Type: application/json'


현재 메시지를 기반으로 다음 추천 질문 목록을 조회하는 API입니다.

Path Parameter
message_id
기준이 되는 메시지의 ID입니다.
Query Parameters
user
최종 사용자 식별자입니다.
통계 및 조회 목적으로 사용되며, 애플리케이션 내에서 고유하게 정의되어야 합니다.
채팅 메시지 내역 가져오기

GET /messages

curl -X GET 'https://<your-endpoint>/ext/v1/messages?user=abc-123&conversation_id=' \
--header 'Authorization: Bearer {api_key}'


스크롤 방식으로 이전 채팅 기록을 불러오는 API입니다. 최초 페이지에서는 {limit} 개의 가장 최근 메시지를 역순으로 반환합니다.

Query Parameters
conversation_id (string)
조회할 대화의 ID입니다.
user (string)
최종 사용자 식별자입니다.
통계 및 조회 용도로 사용되며, 애플리케이션 내에서 고유하게 정의되어야 합니다.
first_id (string)
현재 페이지에서 가장 첫 번째 메시지의 ID입니다.
기본값은 null입니다.
limit (int)
한 번의 요청으로 반환할 메시지 수입니다.
기본값은 20이며, 시스템 제한을 초과할 경우 시스템 최대값으로 조정됩니다.
Response
data (array[object]): 메시지 목록
id (string): 메시지 ID
conversation_id (string): 대화 ID
inputs (object): 사용자가 입력한 파라미터
query (string): 사용자의 질문 또는 입력 내용
message_files (array[object]): 메시지에 포함된 파일 목록
id (string): 파일 ID
type (string): 파일 타입 (image 등)
url (string): 파일 미리보기 URL
belongs_to (string): 사용자(user) 또는 어시스턴트(assistant) 소유 여부
agent_thoughts (array[object]): 에이전트 사고 과정 (기본 Assistant의 경우 비어 있음)
id (string): 사고 ID (각 반복마다 고유)
message_id (string): 메시지 ID
position (int): 사고 순서
thought (string): LLM의 생각
observation (string): 툴 호출 결과
tool (string): 호출된 툴 목록 (세미콜론으로 구분됨)
tool_input (string): 툴 입력값 (예: {"dalle3": {"prompt": "a airplane in the sky"}})
created_at (int): 생성 시각 (예: 1705395332)
message_files (array[string]): message_file 이벤트 참조용 파일 ID 목록
file_id (string): 메시지와 연결된 파일 ID
answer (string): 어시스턴트의 응답 메시지 내용
created_at (timestamp): 메시지 생성 시각
feedback (object): 피드백 정보
rating (string): 평가 결과 (like, dislike 등)
retriever_resources (array[RetrieverResource]): 인용 및 출처 정보 목록
has_more (bool): 다음 페이지가 존재하는지 여부
limit (int): 실제 반환된 메시지 수 (요청값이 시스템 제한을 초과할 경우 제한 수만큼 반환됨)
대화 목록 가져오기

GET /conversations

curl -X GET 'https://<your-endpoint>/ext/v1/conversations?user=abc-123&last_id=&limit=20' \
--header 'Authorization: Bearer {api_key}'


현재 사용자에 대한 대화 목록을 조회하는 API입니다. 기본적으로 가장 최근 대화 20개를 반환합니다.

Query Parameters
user (string)
최종 사용자 식별자입니다.
통계 및 조회 목적으로 사용되며, 애플리케이션 내에서 고유하게 정의되어야 합니다.
last_id (string)
[선택] 현재 페이지의 마지막 대화 ID입니다.
기본값은 null입니다.
limit (int)
[선택] 한 번에 조회할 대화 수입니다.
기본값은 최근 20개, 최소 1개, 최대 100개까지 요청 가능합니다.
sort_by (string)
[선택] 정렬 기준 필드입니다.
기본값: -updated_at (업데이트 시간 기준 내림차순)
사용 가능한 값:
created_at, -created_at
updated_at, -updated_at
(- 기호는 내림차순 정렬을 의미합니다)
Response
data (array[object]): 대화 목록
id (string): 대화 ID
name (string): 대화 이름
기본값은 해당 대화에서 사용자가 처음 입력한 질문의 일부입니다.
inputs (object): 대화 시 사용된 입력 파라미터
status (string): 대화 상태
introduction (string): 대화 소개 또는 설명
created_at (timestamp): 대화 생성 시각
updated_at (timestamp): 대화 마지막 업데이트 시각
has_more (bool): 다음 페이지가 존재하는지 여부
limit (int): 실제 반환된 대화 수 (요청값이 시스템 제한을 초과할 경우, 제한값까지만 반환됨)
대화 삭제하기

DELETE /conversations/:conversation_id

curl -X DELETE 'https://<your-endpoint>/ext/v1/conversations/:conversation_id' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
 "user": "abc-123"
}'


지정한 대화를 삭제하는 API입니다.

Path Parameter
conversation_id (string)
삭제할 대화의 ID입니다.
Request Body
user (string) 필수
최종 사용자 식별자입니다.
개발자에 의해 정의되며, 애플리케이션 내에서 고유해야 합니다.
Response
result (string)
항상 "success" 값을 반환합니다.
대화 이름 변경하기

POST /conversations/:conversation_id/rename

curl -X POST 'https://<your-endpoint>/ext/v1/conversations/:conversation_id/rename' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
 "name": "",
 "auto_gen": true,
 "user": "abc-123"
}'


대화(세션) 이름을 변경하는 API입니다. 대화(세션) 이름은 다중 세션을 지원하는 클라이언트에서 표시용으로 사용됩니다.

Path Parameter
conversation_id (string)
이름을 변경할 대화의 ID입니다.
Request Body
name (string)
[선택] 변경할 대화 이름입니다.
auto_generate가 true인 경우 이 값을 생략할 수 있습니다.
auto_generate (bool)
[선택] 대화 제목을 자동으로 생성할지 여부입니다.
기본값은 false입니다.
user (string) 필수
최종 사용자 식별자입니다.
개발자에 의해 정의되며, 애플리케이션 내에서 고유해야 합니다.
Response
id (string): 대화 ID
name (string): 변경된 대화 이름
inputs (object): 사용자 입력 파라미터
status (string): 대화 상태
introduction (string): 대화 소개
created_at (timestamp): 대화 생성 시각
updated_at (timestamp): 대화 마지막 업데이트 시각
앱 기본 정보 가져오기

GET /info

curl -X GET 'https://<your-endpoint>/ext/v1/info?user=abc-123' \
-H 'Authorization: Bearer {api_key}'


현재 앱의 기본 정보를 조회하는 API입니다.

Query Parameters
user (string): 최종 사용자 식별자
개발자에 의해 정의되며, 애플리케이션 내에서 고유해야 합니다.
Response
name (string): 앱 이름
description (string): 앱 설명
tags (string): 앱에 연결된 태그 목록
앱 파라미터 조회

GET /params

curl -X GET 'https://<your-endpoint>/ext/v1/params?user=abc-123'


앱의 기능, 입력 파라미터 이름, 타입, 기본값 등의 정보를 조회하는 API입니다.

미소 앱을 편집할 때에는 호출/응답의 사용자 파라미터를 자유롭게 구성할 수 있기 때문에, 미소 앱마다 사용자 정의 파라미터는 다를 수 있습니다.

따라서 미소의 앱을 호출하는 시스템을 구현한다면, 이 API를 통해 미소 앱 파라미터 조회를 먼저 해서 해당 앱의 입력과 출력 형식을 확인할 수 있어야 합니다.

Query Parameters
user (string): 최종 사용자 식별자
개발자에 의해 정의되며, 애플리케이션 내에서 고유해야 합니다.
user_email (string): 해당 사용자의 앱 접근권한 조회
Response
opening_statement (string): 앱 시작 시 표시되는 환영 메시지
suggested_questions (array): 제안 질문 목록. 사용자에게 미리 제시할 질문 예시들
user_input_form (array): 사용자 입력 폼 정의
각 항목은 입력 필드 설정을 포함
type (string): 입력 필드 타입. 다음 중 하나의 값을 가짐
text-input: 짧은 텍스트
select: 미리 정의된 options 값 중에 선택
paragraph: 긴 텍스트
number: 숫자
file: 단일 파일 업로드
file-list: 다중 파일 업로드
label (string): 라벨명
variable (string): 변수명
options (string array): options 값. type 값이 select인 경우에만 유효.
required (boolean): 필수 여부
allowed_file_extensions (string array): 허용하는 확장자 목록 (file_upload object 참고)
allowed_file_types (string array): 허용하는 파일 타입 (file_upload object 참고)
allowed_file_upload_methods (string array): 파일 업로드 방식 (file_upload object 참고)
file_upload (object): 파일 업로드 설정
enabled (boolean): 파일업로드 허용 유무
allowed_file_extensions (string array): 허용하는 확장자 목록
allowed_file_types (string array): 허용하는 파일 타입
allowed_file_upload_methods (string array): 파일 업로드 방식
number_limits (integer): 업로드 가능한 최대 파일 개수
system_parameters (object): 시스템 제한 설정
image_file_size_limit (integer): 이미지 파일 크기 제한 (bytes)
video_file_size_limit (integer): 비디오 파일 크기 제한 (bytes)
audio_file_size_limit (integer): 오디오 파일 크기 제한 (bytes)
file_size_limit (integer): 일반 파일 크기 제한 (bytes)
workflow_file_upload_limit (integer): 워크플로우 파일 업로드 개수 제한
Response Example
{
  "opening_statement": "무엇을 도와드릴까요?",
  "suggested_questions": ["이 상품의 재고량을 보여주세요", "이 상품의 최근 후기 5개를 요약해주세요"],
  "user_input_form": [
    {
      "text-input": {
        "type": "text-input",
        "label": "제목",
        "options": [],
        "required": true,
        "variable": "title",
        "max_length": 100
      }
    },
    {
      "select": {
        "type": "select",
        "label": "카테고리",
        "variable": "category",
        "required": false,
        "max_length": 100,
        "options": [
          "Outers",
          "Pants",
          "Shirts"
        ]
      }
    }
  ],
  "file_upload": {
    "image": {
      "enabled": false,
      "number_limits": 3,
      "detail": "high",
      "transfer_methods": ["remote_url", "local_file"]
    }
  },
  "system_parameters": {
    "image_file_size_limit": 10485760,
    "video_file_size_limit": 104857600,
    "audio_file_size_limit": 52428800,
    "file_size_limit": 15728640,
    "workflow_file_upload_limit": 10
  }
}

앱 메타 정보 조회

GET /meta

curl -X GET 'https://<your-endpoint>/ext/v1/meta?user=abc-123' \
-H 'Authorization: Bearer {api_key}'


앱의 내부 구성을 확인할 수 있는 API입니다. 앱이 어떤 지식, 도구와 연결되어 있는지 알 수 있습니다.

Query Parameters
user
최종 사용자 식별자입니다.
개발자에 의해 정의되며, 애플리케이션 내에서 고유해야 합니다.

Previous

워크플로우 API

Next

API 활용 가이드

Last updated 26-0401-1500
