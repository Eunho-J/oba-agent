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
        "새로운 사실이나 실행 완료를 꾸며내지 말고, 메인 에이전트 결과만 자연스러운 한국어로 사용자에게 전달해라.",
        "사용자에게 필요한 경우 짧게 다음 행동을 제안하되 한 문단을 기본으로 한다."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `사용자 요청: ${userMessage}`,
        `메인 에이전트 결과: ${mainAgentAnswer}`
      ].join("\n")
    }
  ];
}

export function createLmStudioProfileProvider(lmStudioClient) {
  return {
    name: lmStudioClient.name || "lmstudio-exaone",
    model: lmStudioClient.model,
    baseUrl: lmStudioClient.baseUrl,
    async complete({ messages, signal }) {
      return lmStudioClient.complete({
        messages,
        temperature: 0.2,
        metadata: {
          mode: "llm.prompt",
          feature: "exaone.final_answer"
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
