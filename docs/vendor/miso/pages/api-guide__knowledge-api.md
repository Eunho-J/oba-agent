---
title: "지식 API"
source: "https://console.miso.gs/learn/api-guide/knowledge-api"
synced_at: "2026-05-30"
nav_title: "지식 API"
---

# 지식 API

Source: https://console.miso.gs/learn/api-guide/knowledge-api

## Outline

- h1: 지식 API
  - h2: 지식 API Key 발급 받기
  - h2: API 접근 범위
  - h2: 텍스트로 문서 생성하기
    - h3: Request Body
    - h3: Response
  - h2: 파일로 문서 생성
    - h3: Request Body
    - h3: Response
  - h2: 텍스트로 문서 업데이트
    - h3: Request Body
    - h3: Response
  - h2: 파일로 문서 업데이트
    - h3: Request Body
    - h3: Response
  - h2: 지식의 문서 목록 조회
    - h3: Response
  - h2: 문서 삭제
    - h3: Response
  - h2: 문서 임베딩 상태 조회 (진행률 확인)
    - h3: Response
  - h2: 문서에 청크(Chunk) 추가
    - h3: Request Body
    - h3: Response
  - h2: 문서에서 청크(Chunk) 조회
    - h3: Response
  - h2: 문서 내 청크(Chunk) 업데이트
    - h3: Request Body
    - h3: Response
  - h2: 문서에서 청크(Chunk) 삭제
    - h3: Response
  - h2: 지식 베이스에서 청크(Chunk) 검색
    - h3: Request Body
    - h3: Response
  - h2: 빈 지식 생성
    - h3: Request Body
    - h3: Response
  - h2: 지식 목록 조회
    - h3: Query Parameters
    - h3: Response
  - h2: 지식 상세 조회
    - h3: Response
  - h2: 지식 삭제
    - h3: Response

## Content

MISO 사용자 매뉴얼
>
미소 API 사용법
>
지식 API
지식 API
지식 API Key 발급 받기
지식 관리 메뉴 진입

상단 메뉴바에서 지식 관리 를 클릭하여 지식 관리 화면으로 이동합니다.

지식 관리 화면
API 키 버튼

워크스페이스 단위 API 키 발급이 중단되었습니다. 기존에 발급받은 키는 사용할 수 있습니다. 지식 상세 페이지에서 지식별로 API 키를 발급해주세요.

특정 지식을 선택 후, 상세 화면에서 API 키 탭을 선택합니다.

API 키 탭 선택

지식 API 키 관리 화면에서 API 키 생성 버튼을 클릭하여 새로운 API키를 발급 받을 수 있습니다. 이 API 키를 header의 Authorization에 Bearer {api_key} 와 같은 형식으로 입력하여 지식 API를 호출할 수 있습니다.

API 접근 범위
API	워크스페이스 API 키	지식 단위 API 키
텍스트로 문서 생성하기	O	O (해당 지식만)
파일로 문서 생성	O	O (해당 지식만)
빈 지식 생성	O	X
지식 목록 조회	O	X
지식 상세 조회	O	O (해당 지식만)
지식 삭제	O	X
텍스트로 문서 업데이트	O	O (해당 지식만)
파일로 문서 업데이트	O	O (해당 지식만)
문서 임베딩 상태 조회 (진행률 확인)	O	O (해당 지식만)
문서 삭제	O	O (해당 지식만)
지식의 문서 목록 조회	O	O (해당 지식만)
문서에 청크(Chunk) 추가	O	O (해당 지식만)
문서에서 청크(Chunk) 조회	O	O (해당 지식만)
문서에서 청크(Chunk) 삭제	O	O (해당 지식만)
문서 내 청크(Chunk) 업데이트	O	O (해당 지식만)
지식 베이스에서 청크(Chunk) 검색	O	O (해당 지식만)
텍스트로 문서 생성하기

기존 지식에 텍스트로 새로운 문서를 생성합니다.

POST /datasets/{id}/docs/text

tag 정보 미 입력시
curl --location --request POST 'https://<your-endpoint>/ext/v1/datasets/{id}/docs/text' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "text",
  "text": "text",
  "indexing_type": "high_quality",
  "process_rule": {
    "mode": "automatic"
  }
}'

tag 정보 입력시
curl --location --request POST 'https://<your-endpoint>/ext/v1/datasets/{id}/docs/text' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "text",
  "text": "text",
  "indexing_type": "high_quality",
  "process_rule": {
    "mode": "automatic"
  },
  "meta_tags" : [
      {
        "key": "year",
        "value": "8888",
        "type": "TEXT"
      },
      {
        "key": "fiscal",
        "value": "8888",
        "type": "TEXT"
      }
   ]
}'

Request Body
name (string): 생성할 문서의 이름
text (string): 문서에 포함될 실제 텍스트 데이터
indexing_type (string): 문서 인덱싱 기법 (예: high_quality)
process_rule (object): 문서 처리 규칙
mode (string): 문서 처리 방식 (예: automatic)
meta_tags (object): 문서 태그 정보 (선택사항)
Response
{
  "document": {
    "id": "",
    "position": 1,
    "data_source_type": "upload_file",
    "data_source_info": {
      "upload_file_id": ""
    },
    "dataset_process_rule_id": "",
    "name": "text.txt",
    "created_from": "api",
    "created_by": "",
    "created_at": 1709999988,
    "tokens": 0,
    "indexing_status": "waiting",
    "error": null,
    "enabled": true,
    "disabled_at": null,
    "disabled_by": null,
    "archived": false,
    "display_status": "queuing",
    "word_count": 0,
    "hit_count": 0,
    "doc_form": "text_model"
  },
  "batch": ""
}

파일로 문서 생성

기존 지식에 파일로 새로운 문서를 생성합니다.

POST /datasets/{id}/docs/file

tag 정보 미 입력시
curl --location --request POST 'https://<your-endpoint>/ext/v1/datasets/{id}/docs/file' \
--header 'Authorization: Bearer {api_key}' \
--form 'data="{"indexing_type":"high_quality","process_rule":{"rules":{"pre_processing_rules":[{"org_doc_id":"remove_extra_spaces","enabled":true},{"org_doc_id":"remove_urls_emails","enabled":true}],"segmentation":{"separator":"###","max_tokens":500}},"mode":"custom"}}";type=text/plain' \
--form 'file=@"/path/to/file"'

tag 정보 입력시
curl --location --request POST 'https://<your-endpoint>/ext/v1/datasets/{id}/docs/file' \
--header 'Authorization: Bearer {api_key}' \
--form 'data="{\"indexing_type\":\"high_quality\",\"process_rule\":{\"mode\":\"automatic\"},\"meta_tags\":[{\"key\":\"year\",\"value\":\"8888\",\"type\":\"TEXT\"},{\"key\":\"fiscal\",\"value\":\"8888\",\"type\":\"TEXT\"}]}"' \
--form 'file=@"/path/to/file"'

Request Body
file (File): 업로드할 파일
data (string): 문서 처리 설정 정보 JSON 문자열
indexing_type (string): 인덱싱 기법
process_rule (object): 문서 처리 규칙
mode (string): 처리 방식 (예: custom)
rules (object): 처리 규칙 상세
pre_processing_rules (array): 사전 처리 규칙 목록
segmentation (object): 문서 분할 설정
separator (string): 문서 분할 구분자
max_tokens (int): 최대 토큰 수
meta_tags (object): 문서 태그 정보
Response
{
  "document": {
    "id": "",
    "position": 1,
    "data_source_type": "upload_file",
    "data_source_info": {
      "upload_file_id": ""
    },
    "dataset_process_rule_id": "",
    "name": "my_doc.txt",
    "created_from": "api",
    "created_by": "",
    "created_at": 1709999912,
    "tokens": 0,
    "indexing_status": "waiting",
    "error": null,
    "enabled": true,
    "disabled_at": null,
    "disabled_by": null,
    "archived": false,
    "display_status": "queuing",
    "word_count": 0,
    "hit_count": 0,
    "doc_form": "text_model"
  },
  "batch": ""
}

텍스트로 문서 업데이트

기존 지식의 문서를 텍스트로 업데이트하는 API입니다.

PUT /datasets/{dataset_id}/docs/{doc_id}/text

curl --location --request PUT 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/docs/{doc_id}/text' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "name",
  "text": "text"
}'

Request Body
name (string): 업데이트할 문서의 이름
text (string): 새로운 텍스트 내용
Response
{
  "document": {
    "id": "",
    "position": 1,
    "data_source_type": "upload_file",
    "data_source_info": {
      "upload_file_id": ""
    },
    "dataset_process_rule_id": "",
    "name": "name.txt",
    "created_from": "api",
    "created_by": "",
    "created_at": 1694240259,
    "tokens": 0,
    "indexing_status": "waiting",
    "error": null,
    "enabled": true,
    "disabled_at": null,
    "disabled_by": null,
    "archived": false,
    "display_status": "queuing",
    "word_count": 0,
    "hit_count": 0,
    "doc_form": "text_model"
  },
  "batch": ""
}

파일로 문서 업데이트

기존 지식의 문서를 파일로 업데이트하는 API입니다.

PUT /datasets/{dataset_id}/docs/{doc_id}/file

curl --location --request PUT 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/docs/{doc_id}/file' \
--header 'Authorization: Bearer {api_key}' \
--form 'data="{"name":"name","indexing_technique":"high_quality","process_rule":{"rules":{"pre_processing_rules":[{"id":"remove_extra_spaces","enabled":true},{"id":"remove_urls_emails","enabled":true}],"segmentation":{"separator":"###","max_tokens":500}},"mode":"custom"}}";type=text/plain' \
--form 'file=@"/path/to/file"'

Request Body
file (File): 업데이트할 파일
data (string): 처리 설정 JSON 문자열
name (string): 문서 이름
indexing_technique (string): 인덱싱 기법
process_rule (object): 처리 규칙
rules (object): 규칙 상세
pre_processing_rules (array): 전처리 규칙 목록
segmentation (object): 분할 설정
mode (string): 처리 모드
Response
{
  "document": {
    "id": "",
    "position": 1,
    "data_source_type": "upload_file",
    "data_source_info": {
      "upload_file_id": ""
    },
    "dataset_process_rule_id": "",
    "name": "my_docs.txt",
    "created_from": "api",
    "created_by": "",
    "created_at": 1699728889,
    "tokens": 0,
    "indexing_status": "waiting",
    "error": null,
    "enabled": true,
    "disabled_at": null,
    "disabled_by": null,
    "archived": false,
    "display_status": "queuing",
    "word_count": 0,
    "hit_count": 0,
    "doc_form": "text_model"
  },
  "batch": "20240921160427555684"
}

지식의 문서 목록 조회

지정한 지식 베이스에 포함된 문서 목록을 조회하는 API입니다.

GET /datasets/{dataset_id}/docs

curl --location --request GET 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/docs' \
--header 'Authorization: Bearer {api_key}'

Response
{
  "data": [
    {
      "id": "",
      "position": 1,
      "data_source_type": "file_upload",
      "data_source_info": null,
      "dataset_process_rule_id": null,
      "name": "my_doc",
      "created_from": "",
      "created_by": "",
      "created_at": 1706152284,
      "tokens": 0,
      "indexing_status": "waiting",
      "error": null,
      "enabled": true,
      "disabled_at": null,
      "disabled_by": null,
      "archived": false
    }
  ],
  "has_more": false,
  "limit": 20,
  "total": 9,
  "page": 1
}

문서 삭제

지정한 문서를 삭제하는 API입니다.

DELETE /datasets/{dataset_id}/docs/{docs_id}

curl --location --request DELETE 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/docs/{docs_id}' \
--header 'Authorization: Bearer {api_key}'

Response
{
  "result": "success"
}

문서 임베딩 상태 조회 (진행률 확인)

문서의 임베딩(인덱싱) 처리 상태 및 진행률을 조회하는 API입니다.

GET /datasets/{id}/docs/{batch}/status

curl --location --request GET 'https://<your-endpoint>/ext/v1/datasets/{id}/docs/{batch}/status' \
--header 'Authorization: Bearer {api_key}'

Response
{
  "data": [{
    "id": "",
    "indexing_status": "indexing",
    "processing_started_at": 1703230131.0,
    "parsing_completed_at": 1703230131.0,
    "cleaning_completed_at": 1703230131.0,
    "splitting_completed_at": 1703230131.0,
    "completed_at": null,
    "paused_at": null,
    "error": null,
    "stopped_at": null,
    "completed_segments": 24,
    "total_segments": 100
  }]
}

문서에 청크(Chunk) 추가

지정한 문서에 하나 이상의 청크(세그먼트)를 추가하는 API입니다.

POST /datasets/{dataset_id}/docs/{doc_id}/segments

curl --location --request POST 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/docs/{doc_id}/segments' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
  "segments": [
    {
      "content": "1",
      "answer": "1",
      "keywords": ["a"]
    }
  ]
}'

Request Body
segments (array): 추가할 세그먼트 배열
content (string): 세그먼트의 텍스트 내용
answer (string): 세그먼트에 대한 답변 또는 요약
keywords (array): 키워드 목록
Response
{
  "data": [{
    "id": "",
    "position": 1,
    "document_id": "",
    "content": "1",
    "answer": "1",
    "word_count": 30,
    "tokens": 0,
    "keywords": [
      "a"
    ],
    "index_node_id": "",
    "index_node_hash": "",
    "hit_count": 0,
    "enabled": true,
    "disabled_at": null,
    "disabled_by": null,
    "status": "completed",
    "created_by": "",
    "created_at": 1707793442,
    "indexing_at": 1707793442,
    "completed_at": 1707793442,
    "error": null,
    "stopped_at": null
  }],
  "doc_form": "text_model"
}

문서에서 청크(Chunk) 조회

지정한 문서에 포함된 청크(세그먼트) 목록을 조회하는 API입니다.

GET /datasets/{dataset_id}/docs/{doc_id}/segments

curl --location --request GET 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/docs/{doc_id}/segments' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json'

Response
{
  "data": [{
    "id": "",
    "position": 1,
    "document_id": "",
    "content": "1",
    "answer": "1",
    "word_count": 25,
    "tokens": 0,
    "keywords": [
      "a"
    ],
    "index_node_id": "",
    "index_node_hash": "",
    "hit_count": 0,
    "enabled": true,
    "disabled_at": null,
    "disabled_by": null,
    "status": "completed",
    "created_by": "",
    "created_at": 1695312007,
    "indexing_at": 1695312007,
    "completed_at": 1695312007,
    "error": null,
    "stopped_at": null
  }],
  "doc_form": "text_model"
}

문서 내 청크(Chunk) 업데이트

지정한 문서의 특정 청크(세그먼트)를 수정하는 API입니다.

PUT /datasets/{dataset_id}/docs/{doc_id}/segments/{segment_id}

curl --location --request PUT 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/docs/{doc_id}/segments/{segment_id}' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
  "segment": {
    "content": "1",
    "answer": "1",
    "keywords": ["a"],
    "enabled": false
  }
}'

Request Body
segment (object): 업데이트할 세그먼트 정보
content (string): 세그먼트 텍스트
answer (string): 답변/요약
keywords (array): 키워드 목록
enabled (boolean): 활성화 여부
Response
{
  "data": [{
    "id": "",
    "position": 1,
    "document_id": "",
    "content": "1",
    "answer": "1",
    "word_count": 25,
    "tokens": 0,
    "keywords": [
      "a"
    ],
    "index_node_id": "",
    "index_node_hash": "",
    "hit_count": 0,
    "enabled": true,
    "disabled_at": null,
    "disabled_by": null,
    "status": "completed",
    "created_by": "",
    "created_at": 1695312007,
    "indexing_at": 1695312007,
    "completed_at": 1695312007,
    "error": null,
    "stopped_at": null
  }],
  "doc_form": "text_model"
}

문서에서 청크(Chunk) 삭제

지정한 문서 내 특정 청크(세그먼트)를 삭제하는 API입니다.

DELETE /datasets/{dataset_id}/docs/{doc_id}/segments/{segment_id}

curl --location --request DELETE 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/docs/{doc_id}/segments/{segment_id}' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json'

Response
{
  "result": "success"
}

지식 베이스에서 청크(Chunk) 검색

지식에서 쿼리에 따라 관련된 청크(세그먼트)를 검색하는 API입니다.

POST /datasets/{dataset_id}/search

curl --location --request POST 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}/search' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
  "query": "test",
  "retrieval_model": {
    "search_method": "keyword_search",
    "reranking_enable": false,
    "reranking_mode": null,
    "reranking_model": {
      "reranking_provider_name": "",
      "reranking_model_name": ""
    },
    "weights": null,
    "top_k": 1,
    "score_threshold_enabled": false,
    "score_threshold": null
  }
}'

Request Body
query (string): 검색할 텍스트 쿼리
retrieval_model (object): 검색 설정
search_method (string): 검색 방식
reranking_enable (boolean): 재정렬 기능 여부
reranking_mode (string): 재정렬 모드
reranking_model (object): 재정렬 모델 설정
reranking_provider_name (string): 재정렬 모델 제공자
reranking_model_name (string): 재정렬 모델명
top_k (int): 상위 결과 개수
score_threshold_enabled (boolean): 점수 기준치 활성화
score_threshold (float): 기준 점수값
Response
{
  "query": {
    "content": "test"
  },
  "records": [
    {
      "segment": {
        "id": "7fa6f24f-8679-48b3-bc9d-bdf28d73f218",
        "position": 1,
        "document_id": "a8c6c36f-9f5d-4d7a-8472-f5d7b75d71d2",
        "content": "Operation guide",
        "answer": null,
        "word_count": 847,
        "tokens": 280,
        "keywords": [
          "install",
          "java",
          "base",
          "scripts",
          "jdk",
          "manual",
          "internal",
          "opens",
          "add",
          "vmoptions"
        ],
        "index_node_id": "39dd8443-d960-45a8-bb46-7275ad7fbc8e",
        "index_node_hash": "0189157697b3c6a418ccf8264a09699f25858975578f3467c76d6bfc94df1d73",
        "hit_count": 0,
        "enabled": true,
        "disabled_at": null,
        "disabled_by": null,
        "status": "completed",
        "created_by": "dbcb1ab5-90c8-41a7-8b78-73b235eb6f6f",
        "created_at": 1728734540,
        "indexing_at": 1728734552,
        "completed_at": 1728734584,
        "error": null,
        "stopped_at": null,
        "document": {
          "id": "a8c6c36f-9f5d-4d7a-8472-f5d7b75d71d2",
          "data_source_type": "upload_file",
          "name": "readme.txt",
          "doc_type": null
        }
      },
      "score": 3.730463140527718e-05,
      "tsne_position": null
    }
  ]
}

빈 지식 생성

빈 지식을 생성하는 API입니다.

POST /datasets

curl --location --request POST 'https://<your-endpoint>/ext/v1/datasets' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "my_knowledge",
  "permission": "only_me"
}'


이 API는 워크스페이스 레벨 API 키로만 호출 가능합니다. 지식 단위 API 키로는 호출할 수 없습니다.

Request Body
name (string): 생성할 지식의 이름
permission (string): 접근 권한 설정 (예: only_me)
Response
{
  "id": "",
  "name": "name",
  "description": null,
  "provider": "vendor",
  "permission": "only_me",
  "data_source_type": null,
  "indexing_technique": null,
  "app_count": 0,
  "document_count": 0,
  "word_count": 0,
  "created_by": "",
  "created_at": 1686706498,
  "updated_by": "",
  "updated_at": 1686706498,
  "embedding_model": null,
  "embedding_model_provider": null,
  "embedding_available": null
}

지식 목록 조회

지식 목록을 조회하는 API입니다.

GET /datasets

curl --location --request GET 'https://<your-endpoint>/ext/v1/datasets?page=1&limit=30' \
--header 'Authorization: Bearer {api_key}'


이 API는 워크스페이스 레벨 API 키로만 호출 가능합니다. 지식 단위 API 키로는 호출할 수 없습니다.

Query Parameters
page (int): 조회할 페이지 번호
limit (int): 한 페이지에 포함할 항목 개수
Response
{
  "data": [
    {
      "id": "",
      "name": "name",
      "description": "desc",
      "permission": "only_me",
      "data_source_type": "upload_file",
      "indexing_technique": "",
      "app_count": 3,
      "document_count": 10,
      "word_count": 1300,
      "created_by": "",
      "created_at": "",
      "updated_by": "",
      "updated_at": ""
    }
  ],
  "has_more": true,
  "limit": 30,
  "total": 70,
  "page": 1
}

지식 상세 조회

지정한 지식의 상세 정보를 조회하는 API입니다.

GET /datasets/{dataset_id}

curl --location --request GET 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}' \
--header 'Authorization: Bearer {api_key}'

Response
{
  "id": "",
  "name": "miso-url-v2.xlsx",
  "description": "miso-url-v2.xlsx의 내용에 대한 답변을 할 때 사용합니다.",
  "provider": "vendor",
  "permission": "only_me",
  "data_source_type": "upload_file",
  "indexing_technique": "high_quality",
  "created_by": "",
  "created_at": 1769083768,
  "updated_by": "",
  "updated_at": 1769083768,
  "embedding_model": "amazon.titan-embed-text-v2:0",
  "embedding_model_provider": "bedrock",
  "retrieval_model_dict": {
    "search_method": "table_search",
    "reranking_enable": false,
    "reranking_mode": "",
    "reranking_model": {
      "reranking_provider_name": "bedrock",
      "reranking_model_name": "amazon.rerank-v1:0"
    },
    "top_k": 5,
    "score_threshold_enabled": false,
    "score_threshold": 0.5
  },
  "app_count": 0,
  "document_count": 1,
  "word_count": 0,
  "created_by_name": "Kade",
  "updated_by_name": "",
  "tags": [],
  "permission_status": {
    "status": "none",
    "permission": null,
    "permission_period": null,
    "members": null
  },
  "document_indexing_status": {
    "error_count": 0,
    "completed_count": 1,
    "in_progress_count": 0,
    "embedding_unavailable_count": 0
  },
  "embedding_available": true
}

지식 삭제

지정한 지식을 삭제하는 API입니다.

DELETE /datasets/{dataset_id}

curl --location --request DELETE 'https://<your-endpoint>/ext/v1/datasets/{dataset_id}' \
--header 'Authorization: Bearer {api_key}'


이 API는 워크스페이스 레벨 API 키로만 호출 가능합니다. 지식 단위 API 키로는 호출할 수 없습니다.

Response
상태 코드 204: 성공적으로 삭제됨 (응답 본문 없음)

Previous

API 활용 가이드

Next

파일 업로드

Last updated 26-0401-1500
