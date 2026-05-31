import { postJson } from "./http.js";

export function callOpenRouter({ apiKey, model, messages, referer, title }) {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");
  return postJson("https://openrouter.ai/api/v1/chat/completions", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(referer ? { "HTTP-Referer": referer } : {}),
      ...(title ? { "X-OpenRouter-Title": title } : {})
    },
    body: {
      model,
      messages
    }
  });
}

