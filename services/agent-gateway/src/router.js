const APIFUSE_HINTS = [
  "날씨",
  "비",
  "미세먼지",
  "장소",
  "길찾기",
  "지도",
  "배송",
  "택배",
  "법령",
  "주차",
  "항공",
  "비행",
  "가격",
  "상품",
  "예약",
  "식당"
];

const LOCAL_WORKFLOW_MEMORY_HINTS = [
  "워크플로우",
  "보고서",
  "요약",
  "메일",
  "회의록",
  "지식",
  "문서",
  "업무",
  "자동화"
];

const SELF_UPDATE_HINTS = [
  "앞으로",
  "바꿔줘",
  "고쳐줘",
  "업데이트",
  "개선",
  "프롬프트",
  "yaml",
  "yml",
  "배포"
];

export function selectRoute(turn, config) {
  const transcript = normalize(turn.transcript);
  const hasLocalWorkflow = config?.localWorkflow?.enabled !== false;
  const hasApiFuse = Boolean(config?.apifuse?.apiKey);
  const hasOpenRouter = Boolean(config?.openrouter?.apiKey);
  const hasExaone = Boolean(config?.exaone?.baseUrl);

  if (!transcript) {
    return route("none", "empty_transcript", { executable: false });
  }

  if (turn.privacyMode || includesAny(transcript, ["비공개", "민감", "내 폰", "오프라인"])) {
    return route("exaone_local", "privacy_or_offline_first", { executable: hasExaone });
  }

  if (includesAny(transcript, SELF_UPDATE_HINTS)) {
    return route("self_update", "agent_self_modification_request", {
      executable: hasOpenRouter
    });
  }

  if (includesAny(transcript, APIFUSE_HINTS)) {
    return route("apifuse", "external_korean_api_needed", { executable: hasApiFuse });
  }

  if (includesAny(transcript, LOCAL_WORKFLOW_MEMORY_HINTS)) {
    return route("local_workflow_memory", "stateless_local_workflow_memory", { executable: hasLocalWorkflow });
  }

  return route("openrouter_gemini", "general_reasoning_default", { executable: hasOpenRouter });
}

export function buildTurnPlan(turn, config) {
  const selected = selectRoute(turn, config);
  const hasExaone = Boolean(config?.exaone?.baseUrl);
  return {
    selected,
    outputLayer: {
      name: "exaone_expression",
      reason: "korean_user_facing_text_expression_and_emotional_intelligence",
      executable: hasExaone,
      mutableSystemPrompt: true,
      promptPath: config?.exaone?.expressionPromptPath || "prompts/exaone-expression.md"
    },
    fallbackOrder: [
      selected.name,
      "local_workflow_memory",
      "openrouter_gemini",
      "exaone_local"
    ].filter((value, index, values) => value !== "none" && values.indexOf(value) === index),
    normalizedInput: {
      transcript: turn.transcript || "",
      userId: turn.userId || "anonymous",
      conversationId: turn.conversationId || "",
      hasLocation: Boolean(turn.context?.location)
    }
  };
}

function route(name, reason, extra) {
  return { name, reason, ...extra };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function includesAny(text, hints) {
  return hints.some((hint) => text.includes(hint));
}
