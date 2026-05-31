---
title: "파일 업로드"
source: "https://console.miso.gs/learn/api-guide/file-upload"
synced_at: "2026-05-30"
nav_title: "파일 업로드"
---

# 파일 업로드

Source: https://console.miso.gs/learn/api-guide/file-upload

## Outline

- h1: 파일 업로드
  - h2: 파일 업로드
    - h3: Request Body
    - h3: Response
    - h3: Errors
  - h2: 파일입력을 받는 Workflow에 실행과정 가이드
    - h3: 전체 플로우 요약
    - h3: STEP 1: 파일을 MISO에 업로드하기 (/upload)
    - h3: STEP 2: Workflow에 파일 전달하기
    - h3: 구현 예시
      - h4: Workflow에서 파일 처리 전체 플로우
    - h3: Chat vs Workflow 비교
      - h4: Chat API
      - h4: Workflow API
    - h3: 주의사항
      - h4: 1. 변수명 확인 필수
      - h4: 2. 파일 타입 매칭
      - h4: 3. inputs 구조 준수
      - h4: 4. 모드 선택
      - h4: 5. 에러 처리
    - h3: FAQ

## Content

MISO 사용자 매뉴얼
>
미소 API 사용법
>
파일 업로드
파일 업로드
파일 업로드

POST /files/upload

curl -X POST 'https://<your-endpoint>/ext/v1/files/upload' \
--header 'Authorization: Bearer {api_key}' \
--form 'file=@localfile;type=image/[png|jpeg|jpg|webp|gif]' \
--form 'user=abc-123'


이미지 파일을 업로드하여 메시지 전송 시 이미지와 텍스트를 함께 처리하는 멀티모달 기능에 활용할 수 있습니다. 현재는 png, jpg, jpeg, webp, gif 형식만 지원됩니다.

Request Body

해당 API는 multipart/form-data 형식으로 요청해야 합니다.

file (File) 필수
업로드할 파일입니다.
user (string) 필수
최종 사용자 식별자입니다.
개발자 규칙에 따라 정의되며, 애플리케이션 내에서 고유해야 합니다.
Response

업로드에 성공하면, 서버는 파일의 ID와 관련 정보를 반환합니다.

id (uuid): 파일 ID
name (string): 파일 이름
size (int): 파일 크기 (바이트 단위)
extension (string): 파일 확장자
mime_type (string): MIME 타입
created_by (uuid): 파일을 업로드한 최종 사용자의 ID
created_at (timestamp): 파일 생성 시각
Errors

파일 업로드 중 발생할 수 있는 오류 목록입니다.

400, no_file_uploaded
업로드할 파일이 제공되지 않았습니다.
400, too_many_files
현재는 하나의 파일만 업로드할 수 있습니다.
400, unsupported_preview
해당 파일은 미리보기를 지원하지 않습니다.
400, unsupported_estimate
해당 파일은 용량 추정 기능을 지원하지 않습니다.
413, file_too_large
파일 크기가 너무 큽니다.
415, unsupported_file_type
지원하지 않는 파일 형식입니다. 현재는 이미지 파일만 허용됩니다.
503, s3_connection_failed
S3 스토리지 서버에 연결할 수 없습니다.
503, s3_permission_denied
S3에 파일을 업로드할 권한이 없습니다.
503, s3_file_too_large
파일 크기가 S3 제한을 초과했습니다.
500, internal_server_error
내부 서버 오류가 발생하였습니다.
파일입력을 받는 Workflow에 실행과정 가이드

MISO Workflow API에서 파일을 처리하는 방법을 설명합니다.

Workflow에서는 채팅과 달리 inputs 내부의 파일 타입 변수로 파일을 전달할 수 있습니다.

전체 플로우 요약
1. 사용자가 파일 선택
   ↓
2. /files/upload로 파일 업로드 (채팅과 동일)
   ↓
3. 파일 ID 받기
   ↓
4. Workflow의 inputs에 파일 변수로 전달
   ↓
5. Workflow 실행 결과 수신

STEP 1: 파일을 MISO에 업로드하기 (/upload)
목표: 파일을 MISO 서버에 업로드하고 파일 ID 받기 (채팅과 동일)

필요한 정보:
- MISO_ENDPOINT: MISO API 엔드포인트 URL
- MISO_API_KEY: API 인증 키
- file: 업로드할 파일 객체
- user: 파일을 업로드하는 사용자 식별자

요청 형식:
- Method: POST
- URL: {MISO_ENDPOINT}/files/upload
- Headers:
   - Authorization: Bearer {MISO_API_KEY}
- Body: FormData
  - file: [파일 객체]
  - user: [사용자 ID]

예상 응답:
{
  "id": "file-xxxxx-xxxxx",  // 업로드된 파일의 고유 ID
  "name": "example.png",
  "size": 1024,
  "created_at": "2024-01-01T00:00:00Z"
}

STEP 2: Workflow에 파일 전달하기
목표: Workflow의 inputs에 파일 타입 변수로 파일 정보 전달

중요: Workflow에서는 files 배열이 아닌 inputs 내부의 변수로 파일을 전달합니다.

필요한 정보:
- 파일 변수명: Workflow에서 정의한 파일 타입 변수의 이름
- upload_file_id: STEP 1에서 받은 파일 ID
- 기타 input 변수들: Workflow에서 정의한 다른 변수들

파일 정보 형식 (inputs 내부):
{
  "type": "image",                    // 파일 타입 (image, document 등)
  "transfer_method": "local_file",    // 전송 방식
  "upload_file_id": "{파일 ID}"       // STEP 1에서 받은 ID
}

요청 형식:
- Method: POST
- URL: {MISO_ENDPOINT}/workflows/run
- Headers:
  - Authorization: Bearer {MISO_API_KEY}
  - Content-Type: application/json
- Body:
{
  "inputs": {
    "query": "사용자 질문",           // 텍스트 변수
    "image_file": {                   // 파일 타입 변수 (변수명은 Workflow에 따라 다름)
      "type": "image",
      "transfer_method": "local_file",
      "upload_file_id": "file-xxxxx-xxxxx"
    },
    "other_variable": "다른 값"       // 기타 변수들
  },
  "mode": "streaming",                // 또는 "blocking"
  "user": "user-123"                  // 사용자 ID
}

응답: mode에 따라 다름
- blocking: 전체 결과를 한 번에 반환
- streaming: Server-Sent Events (SSE) 스트림

구현 예시
Workflow에서 파일 처리 전체 플로우
// 1. 파일 업로드 함수 (채팅과 동일)
async function uploadFileToMISO(file, userId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user', userId);

  const response = await fetch(`${MISO_ENDPOINT}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MISO_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const data = await response.json();
  return data.id; // 파일 ID 반환
}

// 2. Workflow 실행 (파일 포함)
async function runWorkflowWithFile(query, fileId, userId) {
  const response = await fetch(`${MISO_ENDPOINT}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MISO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        // 텍스트 입력
        query: query,

        // 파일 입력 (변수명은 Workflow에서 정의한 이름 사용)
        uploaded_image: {
          type: "image",
          transfer_method: "local_file",
          upload_file_id: fileId
        }

        // 다른 입력 변수들...
      },
      mode: "blocking",  // 또는 "streaming"
      user: userId
    }),
  });

  if (!response.ok) {
    throw new Error(`Workflow failed: ${response.status}`);
  }

  return response.json();
}

// 3. 여러 파일을 처리하는 Workflow 예시
async function runWorkflowWithMultipleFiles(fileIds, userId) {
  const response = await fetch(`${MISO_ENDPOINT}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MISO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        // 각 파일 변수에 파일 정보 전달
        document_file: {
          type: "document",
          transfer_method: "local_file",
          upload_file_id: fileIds.document
        },
        image_file: {
          type: "image",
          transfer_method: "local_file",
          upload_file_id: fileIds.image
        },

        // 파일 배열이 필요한 경우 (Workflow 입력 변수가 다중 파일인 경우)
        additional_files: fileIds.additional.map(id => ({
          type: "image",
          transfer_method: "local_file",
          upload_file_id: id
        }))
      },
      mode: "blocking",
      user: userId
    }),
  });

  return response.json();
}

// 4. 전체 플로우 예시
async function processWorkflowWithFile(file, query, userId) {
  try {
    // 1단계: 파일 업로드
    console.log('파일 업로드 중...');
    const fileId = await uploadFileToMISO(file, userId);
    console.log('파일 업로드 성공:', fileId);

    // 2단계: Workflow 실행
    console.log('Workflow 실행 중...');
    const result = await runWorkflowWithFile(query, fileId, userId);
    console.log('Workflow 실행 완료:', result);

    return result;
  } catch (error) {
    console.error('처리 중 오류:', error);
    throw error;
  }
}

Chat vs Workflow 비교
Chat API
{
  "query": "메시지",
  "files": [
    {
      "type": "image",
      "transfer_method": "local_file",
      "upload_file_id": "file-123"
    }
  ]
}

Workflow API
{
  "inputs": {
    "query": "메시지",
    "image_input": {
      "type": "image",
      "transfer_method": "local_file",
      "upload_file_id": "file-123"
    }
  }
}

주의사항
1. 변수명 확인 필수
Workflow에서 정의한 정확한 변수명 사용
파일 타입 변수인지 확인
필수/선택 여부 확인
2. 파일 타입 매칭
Workflow가 기대하는 파일 타입과 일치해야 함
지원 타입: 문서, 이미지, 오디오, 비디오 등
3. inputs 구조 준수
// 올바른 예
"inputs": {
  "file_variable": {
    "type": "image",
    "transfer_method": "local_file",
    "upload_file_id": "file-id"
  }
}

// 잘못된 예 (Chat API 방식)
"files": [{...}]  // Workflow에서는 사용하지 않음

4. 모드 선택
blocking: 전체 실행 완료 후 결과 반환
streaming: 실행 중간 결과를 실시간으로 받기
5. 에러 처리
400 오류: 변수명 오류, 필수 변수 누락
415 오류: 지원하지 않는 파일 타입
FAQ

Q: Workflow에서 여러 파일을 한 변수에 전달할 수 있나요?

A: Workflow의 입력변수가 다중파일로 설정되어있을 경우 가능합니다. 배열로 파일 정보 객체들을 전달하세요.

[
  { "type": "image", "transfer_method": "local_file", "upload_file_id": "file-1" },
  { "type": "image", "transfer_method": "local_file", "upload_file_id": "file-2" }
]


Q: remote_url 방식도 지원하나요?

A: 네. transfer_method를 "remote_url"로 설정하고 url 필드에 이미지 URL을 제공하면 됩니다:

{
  "type": "image",
  "transfer_method": "remote_url",
  "url": "https://example.com/image.png"
}


Previous

지식 API

Next

워크플로우 앱 생성하기

Last updated 26-0401-1500
