# Client Platform Strategy

Updated: 2026-05-30

## Decision

Use **Expo React Native** as the client direction, with web-first development for the workbench and Android/iOS as native shells over the same React surface.

This is not a plain web app decision and not a pure Android-native decision. The product needs a dynamic agent workbench: workflow builder, node editor, connection mapper, YAML diff, validation review, publish approval, and ggui-rendered UI. That shape is React-heavy and benefits from sharing web and mobile code.

## Why Expo React Native

- Targets Android, iOS, and web from one React Native project.
- Keeps React/TypeScript close to ggui, schema viewers, diff viewers, graph/workflow UI, and the existing Node gateway.
- Lets us validate complex workbench UI quickly in web, then run the same product surface on Android.
- Leaves room for native voice, microphone, file, and deep-link capabilities through Expo development builds when needed.

## Why not Flutter first

Flutter is a strong multiplatform UI stack, especially for polished mobile/desktop apps. It is less natural for this project because the highest-risk UI is not a static native interface; it is a dynamic ggui and YAML editing workbench. Reusing React/ggui/web libraries is more valuable than Flutter's rendering consistency at this stage.

## Why not Android native first

Android native gives the most direct access to speech and platform APIs, but it slows iteration on the actual product question: can an agent safely inspect, edit, validate, and publish its own workflow through a usable interface? Native Android can remain as a later shell or specialized capability layer.

## Proposed repo layout

```text
apps/client
  Expo React Native app
  targets: web, android, ios

packages/workbench-ui
  shared React components
  Workflow Builder
  Node Editor
  Connection Mapper
  Publish Review

services/agent-gateway
  Core agent, local workflow YAML loop, ApiFuse, ggui bridge
```

## Implementation sequence

1. Create `apps/client` with Expo and TypeScript.
2. Bring up web target first for fast workbench iteration.
3. Implement ggui Workbench shell: workflow builder, node editor, connection mapper, publish review.
4. Run the same surface on Android.
5. Add voice adapters:
   - web: microphone capture to gateway
   - native: Expo/native module path for richer Android/iOS voice later
6. Wire the self-update loop to local workflow YAML candidate generation and validation.

## Native capability policy

Use native modules only where the web surface cannot meet the product need:

- low-latency microphone/session control
- background voice capture or wake behavior
- local model/runtime integration
- OS share sheet, file picker, secure storage, notifications

Everything else should begin as shared React workbench UI.

