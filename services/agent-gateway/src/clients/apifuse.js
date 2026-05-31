import { postJson } from "./http.js";

export function callApiFuseOperation({
  baseUrl = "https://api.apifuse.com",
  apiKey,
  providerId,
  operationId,
  body = {},
  connectionId
}) {
  if (!apiKey) throw new Error("APIFUSE_API_KEY is required");
  if (!providerId || !operationId) {
    throw new Error("providerId and operationId are required");
  }

  return postJson(`${baseUrl}/v1/${providerId}/${operationId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(connectionId ? { "X-ApiFuse-Connection-Id": connectionId } : {})
    },
    body
  });
}

