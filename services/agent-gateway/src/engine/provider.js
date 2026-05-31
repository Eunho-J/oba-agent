import { postJson } from "../clients/http.js";

export function createOpenAICompatibleProvider({
  baseUrl = process.env.OBA_PROVIDER_BASE_URL || "http://127.0.0.1:18080/v1",
  apiKey = process.env.OBA_PROVIDER_API_KEY || "unused",
  model = process.env.OBA_PROVIDER_MODEL || "gpt-5.5",
  name = "codex-as-api"
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return {
    name,
    model,
    baseUrl: normalizedBaseUrl,
    async complete({ messages, tools, signal }) {
      return postJson(`${normalizedBaseUrl}/chat/completions`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: {
          model,
          messages,
          ...(tools?.length ? { tools } : {})
        },
        signal
      });
    }
  };
}

export function deriveHealthUrl(baseUrl = process.env.OBA_PROVIDER_BASE_URL || "http://127.0.0.1:18080/v1") {
  if (process.env.OBA_PROVIDER_HEALTH_URL) return process.env.OBA_PROVIDER_HEALTH_URL;
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/\/v1\/?$/, "/health");
  return url.toString();
}
