import assert from "node:assert/strict";
import test from "node:test";
import { buildTurnPlan, selectRoute } from "../src/router.js";

const config = {
  localWorkflow: { enabled: true },
  apifuse: { apiKey: "apifuse-key" },
  openrouter: { apiKey: "or-key" },
  exaone: { baseUrl: "http://127.0.0.1:8000/v1", expressionPromptPath: "prompts/exaone-expression.md" }
};

test("routes privacy-sensitive requests to local EXAONE", () => {
  const route = selectRoute({ transcript: "민감한 내 폰 메모 요약해줘" }, config);
  assert.equal(route.name, "exaone_local");
});

test("routes Korean external API requests to ApiFuse", () => {
  const route = selectRoute({ transcript: "내일 강남역 날씨랑 식당 예약 후보 찾아줘" }, config);
  assert.equal(route.name, "apifuse");
});

test("routes workflow knowledge requests to local workflow memory", () => {
  const route = selectRoute({ transcript: "회의록 요약해서 보고서 워크플로우로 처리해줘" }, config);
  assert.equal(route.name, "local_workflow_memory");
  assert.equal(route.reason, "stateless_local_workflow_memory");
});

test("marks local workflow memory unavailable when disabled", () => {
  const route = selectRoute(
    { transcript: "회의록 요약해서 보고서 워크플로우로 처리해줘" },
    { ...config, localWorkflow: { enabled: false } }
  );
  assert.equal(route.name, "local_workflow_memory");
  assert.equal(route.executable, false);
});

test("routes explicit self-improvement requests to the self-update pipeline", () => {
  const route = selectRoute({ transcript: "앞으로 상품 주문은 비교표 먼저 보여주게 프롬프트를 바꿔줘" }, config);
  assert.equal(route.name, "self_update");
  assert.equal(route.reason, "agent_self_modification_request");
});

test("falls back to Gemini for general reasoning", () => {
  const plan = buildTurnPlan({ transcript: "이번 아이디어의 장단점 분석해줘", userId: "u1" }, config);
  assert.equal(plan.selected.name, "openrouter_gemini");
  assert.equal(plan.normalizedInput.userId, "u1");
});

test("plans EXAONE as the mutable user-facing output layer", () => {
  const plan = buildTurnPlan({ transcript: "오늘 좀 지쳤어. 일 정리 도와줘" }, config);
  assert.equal(plan.outputLayer.name, "exaone_expression");
  assert.equal(plan.outputLayer.executable, true);
  assert.equal(plan.outputLayer.mutableSystemPrompt, true);
  assert.equal(plan.outputLayer.promptPath, "prompts/exaone-expression.md");
});
