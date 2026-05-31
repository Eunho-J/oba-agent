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
        "너는 문장 다듬기 담당이다.",
        "[agent] 안의 문장을 사용자에게 보여줄 최종 문장으로 다듬는다.",
        "새 사실, 추론, 근거, 실행 결과를 추가하지 마라.",
        "내부 구조나 처리 과정을 언급하지 마라.",
        "원문이 자연스러우면 그대로 둔다.",
        "목록, 표, 코드블록, 파일명, 숫자, 링크는 구조와 내용을 유지한다."
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
        "너는 문장 교정자다.",
        "[user] 안의 문장을 의미 변경 없이 맞춤법, 띄어쓰기, 조사만 교정한다.",
        "답변, 인사, 질문, 해석, 요약, 일반화, 추가 정보는 금지다.",
        "원문이 자연스러우면 그대로 둔다.",
        "고유명사, 숫자, 파일명, 경로, 비교 대상, 출력 형식은 그대로 둔다.",
        "출력은 반드시 [agent]와 [/agent] 사이에 교정된 문장만 넣는다."
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
  if (isSimpleGreeting(original) && normalizeForComparison(original) !== normalizeForComparison(extracted)) {
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
