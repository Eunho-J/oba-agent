# Android App Skeleton

이 폴더는 native Android 앱 골격입니다. 로컬 개발 환경은 JDK 21, Android SDK 35, Gradle wrapper 기준으로 설정되어 있으며 `:app:assembleDebug` 빌드가 통과합니다.

## 방향

- `SpeechRecognizer`로 push-to-talk 음성 입력
- `POST /turn`으로 Agent Gateway 호출
- 응답의 `plan.selected.name`을 화면에 표시해 사용자가 어떤 경로로 처리되는지 이해할 수 있게 함
- ggui가 준비되면 WebView 또는 React Native 계층으로 동적 UI 카드 연결

## 다음 작업

1. `MainActivity.kt`를 Compose UI로 확장
2. `SpeechRecognizer`와 `RECORD_AUDIO` 런타임 권한 요청 추가
3. Gateway URL을 debug build config로 주입
4. `/turn` 응답 카드 UI와 ggui WebView 후보 검증

## Build

```bash
./gradlew :app:assembleDebug
```
