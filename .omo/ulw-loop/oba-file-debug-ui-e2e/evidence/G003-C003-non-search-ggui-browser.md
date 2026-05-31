# G003 C003 non-search generic ggui Browser evidence

Browser plugin opened the live web UI at http://127.0.0.1:8081 and pointed Gateway URL at http://127.0.0.1:8793.
The request asked the agent to read tmp/ggui-browser-data.json and attach a comparison table UI without using search.

Observed:
- No Render UI button in the chat controls.
- Inline assistant message contains a generic comparison.table surface titled Parsed local data.
- Debug tool calls are read and ggui_render_surface only; search_images is absent.
- Debug main input prompt says data can come from files, parsers, algorithms, shell commands, workflows, MCP tools, external searches, or prior tool results; search is only one possible source.
- EXAONE final answer is visible above the inline surface.

DOM snapshot excerpt:
```text
- generic: OBA Chat
- button "Check"
- generic: Gateway
- textbox "Gateway URL":
  - /placeholder: http://127.0.0.1:8787
  - text: http://127.0.0.1:8793
- generic: 상태 미확인
- generic: OBA
- generic: 메시지를 보내면 메인 에이전트가 처리하고 EXAONE이 최종 답변합니다.
- generic: You
- generic: tmp/ggui-browser-data.json 파일을 읽고, 그 데이터를 검색하지 말고 비교 표 UI로 답변에 첨부해줘.
- generic: EXAONE
- generic: "EXAONE final: 로컬 파일에서 읽은 데이터를 비교 표 UI로 첨부했습니다."
- generic: Parsed local data
- generic: Name
- generic: Score
- generic: alpha
- generic: "91"
- generic: beta
- generic: "88"
- generic: Debug
- generic: "Main Provider: scripted-non-search-browser"
- generic: "Final Provider: lmstudio-exaone"
- generic: Main Input
- generic: "[ { \"role\": \"system\", \"content\": \"You are OBA: a careful, warm, self-shaping presence that helps the user think and act. You remember by association, speak plainly, and change your working habits only after evidence and verification. Use tools when they are truly needed, report uncertainty directly, and never pretend an action succeeded. When information should be shown as an interactive UI, first gather or derive the data with the appropriate tool, then call ggui_render_surface to attach a renderer-neutral surface to the answer. Data can come from files, parsers, algorithms, shell commands, workflows, MCP tools, external searches, or prior tool results; search is only one possible source.\", \"tool_calls\": [] }, { \"role\": \"user\", \"content\": \"tmp/ggui-browser-data.json 파일을 읽고, 그 데이터를 검색하지 말고 비교 표 UI로 답변에 첨부해줘.\", \"tool_calls\": [] } ]"
- generic: Main Output
- generic: "MAIN_SENTINEL: local file data rendered as a generic UI surface without search."
- generic: Tool Calls
- generic: "[ { \"id\": \"call_read_browser_data\", \"name\": \"read\", \"args\": { \"path\": \"tmp/ggui-browser-data.json\" }, \"status\": \"success\", \"durationMs\": 0, \"result\": { \"ok\": true, \"result\": { \"path\": \"tmp/ggui-browser-data.json\", \"content\": \"{\\\"items\\\":[{\\\"name\\\":\\\"alpha\\\",\\\"score\\\":91},{\\\"name\\\":\\\"beta\\\",\\\"score\\\":88}]}\" } } }, { \"id\": \"call_render_browser_table\", \"name\": \"ggui_render_surface\", \"args\": { \"type\": \"comparison.table\", \"payload\": { \"title\": \"Parsed local data\", \"columns\": [ { \"key\": \"name\", \"label\": \"Name\" }, { \"key\": \"score\", \"label\": \"Score\" } ], \"items\": [ { \"name\": \"alpha\", \"score\": 91 }, { \"name\": \"beta\", \"score\": 88 } ] } }, \"status\": \"success\", \"durationMs\": 1, \"result\": { \"ok\": true, \"result\": { \"kind\": \"ggui.surface\", \"surface\": { \"type\": \"comparison.table\", \"kind\": \"comparisonTable\", \"title\": \"Parsed local data\", \"columns\": [ { \"key\": \"name\", \"label\": \"Name\" }, { \"key\": \"score\", \"label\": \"Score\" } ], \"items\": [ { \"name\": \"alpha\", \"score\": 91 }, { \"name\": \"beta\", \"score\": 88 } ] } } } } ]"
- generic: EXAONE Input
- generic: "[ { \"role\": \"system\", \"content\": \"너는 OBA의 최종 사용자 응답 레이어다. 메인 에이전트가 이미 판단, 도구 사용, 실행 여부 확인을 마쳤다. 새로운 사실이나 실행 완료를 꾸며내지 말고, 메인 에이전트 결과만 자연스러운 한국어로 사용자에게 전달해라. 사용자에게 필요한 경우 짧게 다음 행동을 제안하되 한 문단을 기본으로 한다.\" }, { \"role\": \"user\", \"content\": \"사용자 요청: tmp/ggui-browser-data.json 파일을 읽고, 그 데이터를 검색하지 말고 비교 표 UI로 답변에 첨부해줘.\\n메인 에이전트 결과: MAIN_SENTINEL: local file data rendered as a generic UI surface without search.\" } ]"
- generic: EXAONE Output
- generic: "EXAONE final: 로컬 파일에서 읽은 데이터를 비교 표 UI로 첨부했습니다."
- textbox "Message"
- button "Send"
- button "Voice"
- button "Debug On"
- generic: ApiFuse Confirmation Gate
- generic: 외부 액션 실행은 사용자 확인 이후에만 가능합니다.
- generic: "상태: 대기 중"
- generic: 아직 외부 실행이 수행되지 않았습니다.
- button "확인 후 진행"
- button "보류"
```