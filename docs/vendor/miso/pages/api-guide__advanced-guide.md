---
title: "에이전트/챗워크플로우 API 활용 가이드"
source: "https://console.miso.gs/learn/api-guide/advanced-guide"
synced_at: "2026-05-30"
nav_title: "API 활용 가이드"
---

# 에이전트/챗워크플로우 API 활용 가이드

Source: https://console.miso.gs/learn/api-guide/advanced-guide

## Outline

- h1: 에이전트/챗워크플로우 API 활용 가이드
  - h2: 기본 용어 개념
    - h3: message
    - h3: conversation
    - h3: user
    - h3: task
  - h2: 구현 가이드
    - h3: MISO 앱 정보 받아오기
      - h4: 기본 정보
      - h4: 파라미터
    - h3: 채팅 보내기
      - h4: 스트리밍 모드
      - h4: 블로킹 모드
    - h3: 대화 이어나가기
    - h3: 현재 대화의 채팅 메세지 내역 가져오기
    - h3: 대화 목록 출력
    - h3: 대화 이름 변경하기
    - h3: 추천 질문 받아오기
    - h3: 대화 삭제하기

## Content

MISO 사용자 매뉴얼
>
미소 API 사용법
>
API 활용 가이드
에이전트/챗워크플로우 API 활용 가이드
기본 용어 개념

MISO의 에이전트/챗워크플로우 API에서 사용되는 주요 개념들에 대한 간단한 설명입니다.

message

하나의 채팅 메세지입니다. GET /messages를 호출하여 특정 사용자의 특정 대화의 모든 채팅 메세지들을 받아올 수 있습니다. 특정 conversation(대화)를 클릭한 경우 채팅창에 출력되어야할 메세지들을 GET /messages로 받아올 수 있습니다.

conversation

MISO 앱과의 하나의 대화입니다. conversation(대화)는 message(채팅 메세지)들의 묶음이라고 이해하시면 됩니다.

POST /chat API로 채팅을 시작하면서 conversation_id를 빈 값으로 넘기면 새로운 conversation_id가 생성됩니다. 이후 대화를 이어나가는 경우 응답 받은 conversation_id를 같이 넘겨주면 됩니다. 이 경우 동일한 conversation(대화)로 처리되어 하나의 대화에 후속 채팅 메세지를 보내도록 처리됩니다.

message들이 하나의 conversation 안에 묶여 있는 개념으로 이해해 볼 수 있습니다.

user

MISO 입장에서의 End User의 ID 값입니다. 이 값으로 사용자를 구분하여 채팅 히스토리가 관리됩니다. message(채팅), conversation(대화), task(작업) 모두 user_id로 관리됩니다.

예를 들어 특정 사용자의 대화를 모두 가져와야 하는 경우 GET /messages를 호출하면서 user_id에 해당 사용자의 ID를 넘겨 주어야 합니다.

task

지금 실행 중인 한 번의 (채팅) 호출입니다. POST /chat API를 스트리밍 모드로 호출한 경우 POST /chat/:task_id/stop를 호출하여 해당 task(답변 작업)을 중단시킬 수 있습니다. 블로킹 모드로 호출한 경우에는 동작하지 않습니다.

구현 가이드
MISO 앱 정보 받아오기
기본 정보

GET /info API를 이용하여 MISO 앱의 기본 정보(이름, 설명, 태그)를 받아올 수 있습니다.

API 호출 형식

호출하는 Endpoint는 동일하나 Authorization에 넘겨주는 api_key와 쿼리 파라미터 user에 넘겨주는 user_id를 이용하여 각각의 앱이 식별되는 구조입니다.

curl -X GET 'https://<your-endpoint>/ext/v1/info?user={user_id}' \
-H 'Authorization: Bearer {api_key}'


API 응답 샘플

{
    "name": "MISO SAMPLE APP",
    "description": "MISO API 매뉴얼 작성을 위한 샘플 앱",
    "tags": [
        "SAMPLE"
    ]
}

파라미터

GET /params API를 이용하여 MISO 앱에 설정된 파라미터를 확인할 수 있습니다. 파라미터는 앱 구현 화면에서 "입력 변수"로 설정된 값들입니다.

입력 변수 설정 화면

API 호출 형식

호출하는 Endpoint는 동일하나 Authorization에 넘겨주는 api_key와 쿼리 파라미터 user에 넘겨주는 user_id를 이용하여 각각의 앱이 식별되는 구조입니다.

curl -X GET 'https://<your-endpoint>/ext/v1/params?user={user_id}'


API 응답 샘플

{
    "opening_statement": "",
    "suggested_questions": [],
    "suggested_questions_after_answer": {
        "enabled": true
    },
    "speech_to_text": {
        "enabled": false
    },
    "text_to_speech": {
        "enabled": false,
        "voice": "",
        "language": ""
    },
    "retriever_resource": {
        "enabled": true
    },
    "annotation_reply": {
        "enabled": false
    },
    "more_like_this": {
        "enabled": false
    },
    "user_input_form": [],
    "sensitive_word_avoidance": {
        "enabled": false,
        "type": "",
        "configs": []
    },
    "file_upload": {
        "image": {
            "enabled": true,
            "detail": "high",
            "number_limits": 10,
            "transfer_methods": [
                "local_file",
                "remote_url"
            ]
        },
        "enabled": true,
        "allowed_file_extensions": [
            "JPG",
            "JPEG",
            "PNG",
            "GIF",
            "WEBP",
            "SVG"
        ],
        "allowed_file_types": [
            "image"
        ],
        "allowed_file_upload_methods": [
            "local_file",
            "remote_url"
        ],
        "number_limits": 10
    },
    "require_initial_chat_input": {
        "enabled": true
    },
    "system_parameters": {
        "image_file_size_limit": 10,
        "video_file_size_limit": 100,
        "audio_file_size_limit": 50,
        "file_size_limit": 50,
        "workflow_file_upload_limit": 10
    }
}

채팅 보내기

POST /chat API를 이용하여 구현한 앱에 채팅 메세지를 보낼 수 있습니다. 이후 user 파라미터에 넘겨진 값 기준으로 채팅을 조회할 수 있습니다. user 파라미터는 채팅 앱을 사용하는 사용자의 ID값 개념으로 볼 수 있습니다.

스트리밍 모드

Server-Sent Events(SSE)를 통해 채팅을 스트리밍으로 실시간으로 받아오는 모드입니다. 화면에 실시간으로 채팅 메세지를 출력하도록 구현할 수 있습니다.

conversation_id를 비워 두고 호출하면 새로운 대화(conversation)가 시작됩니다.
응답 받은 데이터에서 세팅된 conversation_id를 다음 채팅 보내기 호출에 넘겨주면 해당 대화(conversation)에서 이어서 채팅하는 것으로 처리됩니다.
응답 받는 데이터에서 task_id를 추출하여 POST /chat/:task_id/stop를 호출하면 답변 생성을 멈추도록 할 수 있습니다.
답변 생성 중지는 스트리밍 모드에서만 가능합니다.

API 호출 예시

curl -X POST 'https://<your-endpoint>/ext/v1/chat' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "query": "What are the specs of the iPhone 13 Pro Max?",
    "mode": "streaming",
    "conversation_id": "",
    "user": "abc-123"
}'

블로킹 모드

채팅 답변이 모두 완성된 뒤 한 번에 받습니다.

API 호출 예시

curl -X POST 'https://<your-endpoint>/ext/v1/chat' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "query": "What are the specs of the iPhone 13 Pro Max?",
    "mode": "blocking",
    "conversation_id": "",
    "user": "abc-123"
}'


블로킹 모드 API 응답 샘플

{
    "event": "message",
    "task_id": "1fa6295f-3c58-4bae-aa0b-4638181d71d7",
    "id": "1c4e79fa-8ecd-44b3-a833-14095df7f8f9",
    "message_id": "1c4e79fa-8ecd-44b3-a833-14095df7f8f9",
    "conversation_id": "50e3440b-1568-4d0b-859c-cf9d74193791",
    "mode": "agent-chat",
    "answer": "The iPhone 13 Pro Max, released in September 2021, has the following key specifications:\n\n1. Display: 6.7-inch Super Retina XDR OLED with ProMotion (120Hz refresh rate)\n2. Resolution: 2778 x 1284 pixels at 458 ppi\n3. Chip: A15 Bionic with 5-core GPU\n4. Storage options: 128GB, 256GB, 512GB, 1TB\n5. RAM: 6GB\n6. Rear cameras:\n   - 12MP Wide (f/1.5 aperture)\n   - 12MP Ultra Wide (f/1.8 aperture)\n   - 12MP Telephoto (f/2.8 aperture, 3x optical zoom)\n   - LiDAR scanner for night mode and AR\n7. Front camera: 12MP TrueDepth (f/2.2 aperture)\n8. Video recording: Up to 4K at 60 fps, HDR video with Dolby Vision\n9. Battery life: Up to 28 hours of video playback\n10. Charging: MagSafe wireless charging up to 15W, Qi wireless charging up to 7.5W\n11. Water resistance: IP68 (up to 6 meters for 30 minutes)\n12. Operating system: iOS 15 (upgradable)\n13. Face ID for secure authentication\n14. 5G capability\n15. Dimensions: 160.8 x 78.1 x 7.65 mm\n16. Weight: 238 grams\n\nThese specs may vary slightly depending on the region and specific model.",
    "metadata": {
        "usage": {
            "prompt_tokens": 27,
            "prompt_unit_price": "0.003",
            "prompt_price_unit": "0.001",
            "prompt_price": "0.0000810",
            "completion_tokens": 397,
            "completion_unit_price": "0.015",
            "completion_price_unit": "0.001",
            "completion_price": "0.0059550",
            "total_tokens": 424,
            "total_price": "0.0060360",
            "currency": "USD",
            "latency": 8.16101919207722
        }
    },
    "created_at": 1762750223
}

대화 이어나가기

앞서 채팅 보내기에서 받은 응답에서 conversation_id를 확인합니다. POST /chat을 호출하면서 conversation_id를 넘겨주면 앞서 보낸 채팅 메세지에 이어서 conversation(대화)를 이어나갈 수 있습니다.

API 호출 예시

{
    "query": "한글로 정리해줘",
    "mode": "blocking",
    "conversation_id": "50e3440b-1568-4d0b-859c-cf9d74193791",
    "user": "abc-123"
}


API 응답 샘플

{
    "event": "message",
    "task_id": "7352356a-09fb-445b-9336-adda842d9e0b",
    "id": "3890de0d-3d13-43be-9e30-e3157c9f8969",
    "message_id": "3890de0d-3d13-43be-9e30-e3157c9f8969",
    "conversation_id": "50e3440b-1568-4d0b-859c-cf9d74193791",
    "mode": "agent-chat",
    "answer": "아이폰 13 프로 맥스의 주요 사양을 한글로 정리하면 다음과 같습니다:\n\n1. 디스플레이: 6.7인치 Super Retina XDR OLED, ProMotion 기술 (120Hz 주사율)\n2. 해상도: 2778 x 1284 픽셀 (458 ppi)\n3. 칩: A15 Bionic (5코어 GPU)\n4. 저장 용량: 128GB, 256GB, 512GB, 1TB\n5. RAM: 6GB\n6. 후면 카메라:\n   - 12MP 와이드 (f/1.5 조리개)\n   - 12MP 울트라 와이드 (f/1.8 조리개)\n   - 12MP 망원 (f/2.8 조리개, 3배 광학 줌)\n   - LiDAR 스캐너 (야간 모드 및 AR용)\n7. 전면 카메라: 12MP TrueDepth (f/2.2 조리개)\n8. 동영상 녹화: 4K 60fps, Dolby Vision HDR 지원\n9. 배터리 수명: 최대 28시간 비디오 재생\n10. 충전: MagSafe 무선 충전 최대 15W, Qi 무선 충전 최대 7.5W\n11. 방수: IP68 등급 (최대 6m 깊이에서 30분)\n12. 운영체제: iOS 15 (업그레이드 가능)\n13. Face ID 얼굴 인식 보안\n14. 5G 지원\n15. 크기: 160.8 x 78.1 x 7.65 mm\n16. 무게: 238g\n\n지역과 특정 모델에 따라 사양이 약간 다를 수 있습니다.",
    "metadata": {
        "usage": {
            "prompt_tokens": 437,
            "prompt_unit_price": "0.003",
            "prompt_price_unit": "0.001",
            "prompt_price": "0.0013110",
            "completion_tokens": 550,
            "completion_unit_price": "0.015",
            "completion_price_unit": "0.001",
            "completion_price": "0.0082500",
            "total_tokens": 987,
            "total_price": "0.0095610",
            "currency": "USD",
            "latency": 8.103311097249389
        }
    },
    "created_at": 1762750420
}

현재 대화의 채팅 메세지 내역 가져오기

GET /messages API를 이용하여 하나의 대화(conversation)에 해당되는 채팅 메세지 내역을 가져옵니다. 아래 API를 활용해 채팅 메세지들을 가져오고 화면에 순서대로 출력하여 채팅 메세지 화면을 구현할 수 있습니다.

API 호출 예시

curl -X GET 'https://<your-endpoint>/ext/v1/messages?user=abc-123&conversation_id=50e3440b-1568-4d0b-859c-cf9d74193791' \
--header 'Authorization: Bearer {api_key}'


API 응답 샘플

{
    "limit": 20,
    "has_more": false,
    "data": [
        {
            "id": "1c4e79fa-8ecd-44b3-a833-14095df7f8f9",
            "conversation_id": "50e3440b-1568-4d0b-859c-cf9d74193791",
            "parent_message_id": "00000000-0000-0000-0000-000000000000",
            "inputs": {},
            "query": "What are the specs of the iPhone 13 Pro Max?",
            "answer": "The iPhone 13 Pro Max, released in September 2021, has the following key specifications:...",
            "message_files": [],
            "feedback": null,
            "retriever_resources": [],
            "created_at": 1762750223,
            "agent_thoughts": [
                {
                    "id": "38297e29-d2cf-4b2b-9e45-c43cf2be6915",
                    "chain_id": null,
                    "message_id": "1c4e79fa-8ecd-44b3-a833-14095df7f8f9",
                    "position": 1,
                    "thought": "...",
                    "tool": "",
                    "tool_labels": {},
                    "tool_input": "",
                    "created_at": 1762750223,
                    "observation": "",
                    "message_files": []
                }
            ],
            "status": "normal",
            "error": null
        },
        {
            "id": "3890de0d-3d13-43be-9e30-e3157c9f8969",
            "conversation_id": "50e3440b-1568-4d0b-859c-cf9d74193791",
            "parent_message_id": "00000000-0000-0000-0000-000000000000",
            "inputs": {},
            "query": "한글로 정리해줘",
            "answer": "아이폰 13 프로 맥스의 주요 사양을 한글로 정리하면 다음과 같습니다:...",
            "message_files": [],
            "feedback": null,
            "retriever_resources": [],
            "created_at": 1762750420,
            "agent_thoughts": [
                {
                    "id": "a5c4115b-39c4-4edb-878f-07cc6a7de234",
                    "chain_id": null,
                    "message_id": "3890de0d-3d13-43be-9e30-e3157c9f8969",
                    "position": 1,
                    "thought": "...",
                    "tool": "",
                    "tool_labels": {},
                    "tool_input": "",
                    "created_at": 1762750420,
                    "observation": "",
                    "message_files": []
                }
            ],
            "status": "normal",
            "error": null
        }
    ]
}

대화 목록 출력

GET /conversations API를 이용하여 현재 사용자(user)의 모든 conversation(대화) 목록을 가져올 수 있습니다. 하나의 채팅이 아닌 대화(conversation) 목록을 가져옵니다.

GET /conversations API를 활용하여 ChatGPT의 좌측 패널에 있는 대화 목록을 출력하는 것과 유사한 화면을 구현할 수 있습니다.

API 호출 형식

curl -X GET 'https://<your-endpoint>/ext/v1/conversations?user=abc-123&last_id=&limit=20' \
--header 'Authorization: Bearer {api_key}'


API 응답 샘플

{
    "limit": 20,
    "has_more": false,
    "data": [
        {
            "id": "50e3440b-1568-4d0b-859c-cf9d74193791",
            "name": "Asking iPhone 13 Pro Max specs",
            "inputs": {},
            "status": "normal",
            "introduction": "",
            "created_at": 1762740105,
            "updated_at": 1762740105
        }
    ]
}

대화 이름 변경하기

POST /conversations/:conversation_id/rename API를 호출하여 각각의 대화(conversation)의 이름을 변경할 수 있습니다.

API 호출 예시

curl -X POST 'https://<your-endpoint>/ext/v1/conversations/50e3440b-1568-4d0b-859c-cf9d74193791/rename' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
 "name": "아이폰 관련 문의",
 "user": "abc-123"
}'


conversation_id에 앞서 대화 목록 출력에서 확인한 conversation_id(50e3440b-1568-4d0b-859c-cf9d74193791)를 입력하여 name을 "아이폰 관련 문의"로 설정하여 호출하면 아래와 같은 결과를 받을 수 있습니다.

API 응답 샘플

{
    "id": "50e3440b-1568-4d0b-859c-cf9d74193791",
    "name": "아이폰 관련 문의",
    "inputs": {},
    "status": "normal",
    "introduction": "",
    "created_at": 1762740105,
    "updated_at": 1762757954
}


다시 대화 목록 출력 API를 호출하면 아래와 같이 대화의 이름이 변경된 점을 확인할 수 있습니다.

{
    "limit": 20,
    "has_more": false,
    "data": [
        {
            "id": "50e3440b-1568-4d0b-859c-cf9d74193791",
            "name": "아이폰 관련 문의",
            "inputs": {},
            "status": "normal",
            "introduction": "",
            "created_at": 1762740105,
            "updated_at": 1762757954
        }
    ]
}

추천 질문 받아오기

GET /messages/{message_id}/suggest-questions API를 이용하여 특정 채팅 메세지에 대해서 이어지는 질문을 제안할 수 있습니다. 반드시 앱 구현 화면에서 "질문 제안" 기능이 활성화된 상태에서만 추천 질문 받아오기를 할 수 있습니다.

질문 제안 기능 설정 화면

API 호출 형식

curl -X GET 'https://<your-endpoint>/ext/v1/messages/{message_id}/suggest-questions?user=abc-123' \
--header 'Authorization: Bearer {api_key}'


API 응답 형식

{
    "result": "success",
    "data": [
        "추천 질문 제안1",
        "추천 질문 제안2",
        "추천 질문 제안3"
    ]
}

대화 삭제하기

DELETE /conversations/:conversation_id API를 이용하여 특정 대화(conversation)을 삭제할 수 있습니다.

API 호출 형식

curl -X DELETE 'https://<your-endpoint>/ext/v1/conversations/:conversation_id' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
 "user": "abc-123"
}'


API 응답 형식

{
    "result": "success"
}


Previous

에이전트/챗워크플로우 API

Next

지식 API

Last updated 26-0401-1500
