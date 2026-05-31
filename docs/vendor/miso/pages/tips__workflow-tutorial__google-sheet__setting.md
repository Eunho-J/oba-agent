---
title: "[참고] Google Sheet 도구 키 발급 받기"
source: "https://console.miso.gs/learn/tips/workflow-tutorial/google-sheet/setting"
synced_at: "2026-05-30"
nav_title: "[참고] Google Sheet 키 발급"
---

# [참고] Google Sheet 도구 키 발급 받기

Source: https://console.miso.gs/learn/tips/workflow-tutorial/google-sheet/setting

## Outline

- h1: [참고] Google Sheet 도구 키 발급 받기
  - h2: STEP 1. Google Sheets API 활성화
  - h2: STEP 2. 서비스 계정 생성
  - h2: STEP 3. JSON 키 발급
  - h2: STEP 4. MISO 도구 등록

## Content

MISO 사용자 매뉴얼
>
미소 활용법
>
따라하며 배우는 MISO 워크플로우
>
2. 설문 데이터로 VOC 분석하기
>
[참고] Google Sheet 키 발급
[참고] Google Sheet 도구 키 발급 받기
STEP 1. Google Sheets API 활성화
GCP 사이트에 접속:
Google Cloud Console에 접속 후 로그인합니다.
52g.team 과 같은 회사 계정은 계정 생성이 차단될 수 있습니다.
기존 프로젝트를 선택하거나 새 프로젝트를 생성합니다.
GCP 접속
프로젝트 선택
API 활성화:
좌측 메뉴에서 API 및 서비스 > 라이브러리로 이동합니다.
API 라이브러리
검색창에 "Google Sheets API"를 입력하고 사용 설정을 클릭합니다.
Sheets API 활성화
STEP 2. 서비스 계정 생성

서비스 계정 메뉴로 이동:

좌측 메뉴에서 IAM 및 관리자 > 서비스 계정으로 이동합니다.
서비스 계정 메뉴

서비스 계정 생성:

서비스 계정 만들기를 클릭하고 서비스 계정 이름을 입력하여 생성합니다.
서비스 계정 생성
STEP 3. JSON 키 발급

키 생성:

생성된 서비스 계정을 클릭한 후 키 관리로 이동합니다.
아래 사진의 이메일 부분은 추후 이 도구를 사용하는 사용자에게 필요한 정보입니다. 복사 후 공지하기 바랍니다.
키 관리
키 추가 > 새 키 만들기를 선택하고 JSON 형식을 선택합니다.
JSON 키 생성

JSON 파일:

JSON 파일이 자동으로 다운로드되며, 이 파일이 API 인증에 필요한 서비스 계정 키입니다.
해당 JSON 파일을 열어서 복사합니다. (안열리는 경우 텍스트 파일(메모장)으로 열기)
STEP 4. MISO 도구 등록

MISO 플레이그라운드 - 도구 - Google Sheet를 검색 후 복사한 JSON 키를 붙여넣습니다.

MISO 도구 등록

활성화 상태를 확인합니다.

'사용자 권한이 부족합니다. 관리자에게 문의해주세요.' 오류가 발생해요.

MISO에서 도구 등록은 해당 워크스페이스의 관리자 권한을 가진 사용자만 가능합니다.

도구 등록이 필요한 경우, 워크스페이스 관리자에게 문의하여 등록을 요청해 주세요.

Previous

[레벨 4] 더 효율적으로 데이터 추가

Next

공공데이터 오픈API 활용

Last updated 26-0401-1500
