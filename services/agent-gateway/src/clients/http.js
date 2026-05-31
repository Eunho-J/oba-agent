export async function postJson(url, { headers = {}, body, signal } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body ?? {}),
    signal
  });

  const text = await response.text();
  const data = parseJson(text);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} from ${url}`);
    error.status = response.status;
    error.data = data ?? text;
    throw error;
  }
  return data ?? text;
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

