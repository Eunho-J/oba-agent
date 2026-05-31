import { createId } from "./ids.js";
import { toErrorPayload } from "../tools/errors.js";

export function createLogger({ sink } = {}) {
  const write = sink || ((event) => {
    const line = JSON.stringify(event);
    if (event.level === "error") console.error(line);
    else console.log(line);
  });

  return {
    event(name, fields = {}) {
      write({
        ts: new Date().toISOString(),
        level: fields.level || "info",
        event: name,
        ...sanitize(fields),
        traceId: fields.traceId,
        spanId: fields.spanId || createId("span"),
        parentSpanId: fields.parentSpanId
      });
    }
  };
}

export function serializeError(error) {
  return toErrorPayload(error);
}

function sanitize(value) {
  const redacted = { ...value };
  delete redacted.level;
  if (redacted.headers?.Authorization) redacted.headers = { ...redacted.headers, Authorization: "[redacted]" };
  if (redacted.body) redacted.bodyPreview = preview(redacted.body);
  delete redacted.body;
  return redacted;
}

function preview(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 240 ? `${text.slice(0, 240)}...` : text;
}
