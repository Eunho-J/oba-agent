import { runAgentTurn } from "./agent.js";
import { createDefaultAgentProfiles, getAgentProfile, toolModeForProfile } from "./profiles.js";

export const PROFILED_ENGINE_ENTRYPOINT = "runProfiledAgentTurn";
export const PROFILED_ENGINE_MODULE = "services/agent-gateway/src/engine/profiled-agent.js";

export async function runProfiledAgentTurn({
  profileId,
  profiles,
  message,
  initialMessages,
  provider,
  registry,
  logger,
  conversationId = "",
  metadata = {},
  memoryStore,
  contextOptions,
  turnTimeoutMs,
  overrideToolMode,
  maxProviderCalls,
  maxToolCalls
} = {}) {
  const profile = getAgentProfile(profiles || createDefaultAgentProfiles(), profileId);
  const result = await runAgentTurn({
    message,
    conversationId,
    toolMode: overrideToolMode || toolModeForProfile(profile),
    metadata: { ...metadata, profileId },
    provider,
    registry,
    logger,
    memoryStore,
    contextOptions,
    initialMessages,
    claimCheckEnabled: profile.providerRoute !== "emotional",
    turnTimeoutMs,
    maxProviderCalls,
    maxToolCalls
  });
  return {
    ...result,
    metadata: {
      ...(result.metadata || {}),
      profile: profileDebug(profile),
      debug: {
        ...(result.metadata?.debug || {}),
        profiledEngine: {
          entrypoint: PROFILED_ENGINE_ENTRYPOINT,
          module: PROFILED_ENGINE_MODULE,
          profile: profileDebug(profile)
        }
      }
    }
  };
}

export function buildFinalAnswerMessages({ mainAgentAnswer }) {
  return [
    {
      role: "system",
      content: [
        "너는 OBA의 최종 사용자 응답 레이어다.",
        "메인 에이전트가 이미 판단, 도구 사용, 실행 여부 확인을 마쳤다.",
        "메인 에이전트 결과에 없는 사실, 근거, 파일명, 실행 완료, 다음 상태를 절대 추가하지 마라.",
        "메인 에이전트 결과에 파일 목록, 코드블록, 표, 번호 목록, 도구 결과가 있으면 생략하거나 요약하지 말고 구조와 핵심 항목을 그대로 보존해라.",
        "짧은 결과만 자연스러운 한국어 한 문단으로 다듬고, 긴 결과는 원래 줄바꿈과 목록을 유지해라.",
        "확신이 없으면 새로 추측하지 말고 메인 에이전트 결과를 그대로 전달해라."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        "[agent]",
        mainAgentAnswer,
        "[/agent]"
      ].join("\n")
    }
  ];
}

export function buildInputTranslationMessages({ userMessage }) {
  return [
    {
      role: "system",
      content: [
        "너는 OBA의 입력 번역/정규화 레이어다.",
        "사용자의 [user] 입력을 메인 에이전트가 처리하기 좋은 요청으로 바꾼다.",
        "출력은 반드시 [agent]와 [/agent] 사이의 요청문만 포함해라.",
        "입력 [user] 블록을 그대로 다시 출력하거나, 메타 설명(예: 메인 에이전트에게 요청합니다)을 덧붙이지 마라.",
        "사용자 입력이 짧은 인사(예: 안녕, hi)라면 의미를 과장하거나 장문으로 확장하지 말고 같은 톤의 짧은 요청으로 유지해라.",
        "의도, 제약, 파일명, 경로, 언어, 정서적 뉘앙스는 보존하고 새로운 사실이나 실행 결과를 만들지 마라.",
        "도구 사용 여부나 UI 첨부 여부는 메인 에이전트가 판단한다."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        "[user]",
        userMessage,
        "[/user]"
      ].join("\n")
    }
  ];
}

export function extractAgentTaggedContent(content, fallback) {
  const text = typeof content === "string" ? content : "";
  const closed = text.match(/\[agent\]([\s\S]*?)\[\/agent\]/u);
  const open = text.match(/\[agent\]([\s\S]*)$/u);
  const extracted = (closed?.[1] || open?.[1] || "").trim();
  return extracted || fallback;
}

const SIMPLE_GREETING_REGEX = /^(?:안녕(?:하세요)?|하이|ㅎㅇ|hello|hi|hey|yo|반가워|좋은\s*(?:아침|점심|저녁))[\s!?.,~]*$/iu;
const META_TRANSLATION_REGEX = /(메인\s*에이전트|전달할\s*요청|요청합니다|요청을\s*작성|사용자(?:의)?\s*(?:입력|요청|질문)|분석하고|보고하도록)/u;
const SAFE_GREETING_EQUIVALENTS = new Set(["안녕", "안녕하세요", "안녕!", "안녕하세요!", "hello", "hi", "hey"]);
const VOLATILE_FACT_PATTERNS = [
  /\b\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\b/u,
  /(?:오늘|내일|어제).{0,12}(?:날씨|기온|temperature|weather|뉴스|속보)/iu,
  /(?:기온|temperature)\s*[:은는]?\s*-?\d{1,2}(?:\.\d+)?\s*(?:도|℃|°c|°f)/iu,
  /(?:최신|방금).{0,12}(?:뉴스|소식).{0,20}(?:확인|조회|찾았|봤)/u
];

function normalizeForComparison(text) {
  return String(text || "").trim().replace(/\s+/gu, " ").toLowerCase();
}

function isSimpleGreeting(text) {
  return SIMPLE_GREETING_REGEX.test(String(text || "").trim());
}

function isSafeGreetingEquivalent(original, translated) {
  const originalNorm = normalizeForComparison(original);
  const translatedNorm = normalizeForComparison(translated);
  if (!translatedNorm) return false;
  if (originalNorm === translatedNorm) return true;
  return SAFE_GREETING_EQUIVALENTS.has(translatedNorm);
}

export function normalizeMainAgentInput({ userMessage, translatedContent }) {
  const original = typeof userMessage === "string" ? userMessage.trim() : "";
  const raw = typeof translatedContent === "string" ? translatedContent : "";
  const extracted = extractAgentTaggedContent(raw, "").trim();
  if (!extracted) {
    return {
      text: original,
      fallbackToOriginal: true,
      reason: "MISSING_AGENT_TAG"
    };
  }
  if (META_TRANSLATION_REGEX.test(extracted) && extracted.length > Math.max(original.length + 8, 16)) {
    return {
      text: original,
      fallbackToOriginal: true,
      reason: "OVER_EXPANDED_TRANSLATION"
    };
  }
  if (isSimpleGreeting(original) && !isSafeGreetingEquivalent(original, extracted)) {
    return {
      text: original,
      fallbackToOriginal: true,
      reason: "SIMPLE_GREETING_OVER_EXPANDED"
    };
  }
  return {
    text: extracted,
    fallbackToOriginal: false,
    reason: null
  };
}

export function chooseFinalAnswer({ mainAgentAnswer, exaoneAnswer }) {
  const main = typeof mainAgentAnswer === "string" ? mainAgentAnswer.trim() : "";
  const exaone = typeof exaoneAnswer === "string" ? exaoneAnswer.trim() : "";
  if (!exaone) {
    return {
      answer: main,
      fallbackToMainAnswer: true,
      reason: "EMPTY_EXAONE_FINAL"
    };
  }
  const hasUnsupportedVolatileFacts = VOLATILE_FACT_PATTERNS.some((pattern) => (
    pattern.test(exaone) && !pattern.test(main)
  ));
  if (hasUnsupportedVolatileFacts) {
    return {
      answer: main,
      fallbackToMainAnswer: true,
      reason: "UNSUPPORTED_VOLATILE_FACTS"
    };
  }
  return {
    answer: exaone,
    fallbackToMainAnswer: false,
    reason: null
  };
}

export function createLmStudioProfileProvider(lmStudioClient, { feature = "exaone.final_answer" } = {}) {
  return {
    name: lmStudioClient.name || "lmstudio-exaone",
    model: lmStudioClient.model,
    baseUrl: lmStudioClient.baseUrl,
    async complete({ messages, signal }) {
      return lmStudioClient.complete({
        messages,
        temperature: 0,
        metadata: {
          mode: "llm.prompt",
          feature
        },
        signal
      });
    }
  };
}

function profileDebug(profile) {
  return {
    id: profile.id,
    tools: profile.tools,
    mcp: profile.mcp,
    ggui: profile.ggui,
    memoryLane: profile.memoryLane,
    selfImprovementSignals: profile.selfImprovementSignals,
    providerRoute: profile.providerRoute
  };
}
