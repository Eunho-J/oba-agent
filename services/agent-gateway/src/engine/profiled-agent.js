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

export function buildFinalAnswerMessages({ userMessage, mainAgentAnswer }) {
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
        "[user]",
        userMessage,
        "[/user]",
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
        "사용자의 [user] 입력을 메인 에이전트가 처리하기 좋은 [agent] 요청으로 바꾼다.",
        "의도, 제약, 파일명, 경로, 언어, 정서적 뉘앙스는 보존하고 새로운 사실이나 실행 결과를 만들지 마라.",
        "도구 사용 여부나 UI 첨부 여부는 메인 에이전트가 판단한다.",
        "출력은 반드시 [agent]와 [/agent] 사이의 요청문만 포함해라."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        "[user]",
        userMessage,
        "[/user]",
        "[agent]",
        "메인 에이전트에게 전달할 요청을 작성해라.",
        "[/agent]"
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
