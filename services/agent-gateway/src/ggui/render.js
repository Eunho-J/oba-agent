import { gguiRenderValidationError } from "./errors.js";

const SUPPORTED_INTENT_TYPES = new Map([
  ["image.gallery", "image.gallery"],
  ["imageGallery", "image.gallery"],
  ["comparison.table", "comparison.table"],
  ["comparisonTable", "comparison.table"]
]);

export function normalizeRenderIntentRequest(body) {
  if (!isPlainObject(body)) {
    throw gguiRenderValidationError("request body must be a JSON object", { path: "$" });
  }
  if (body.intent !== undefined) {
    if (!isPlainObject(body.intent)) {
      throw gguiRenderValidationError("intent must be a JSON object", { path: "$.intent" });
    }
    return body.intent;
  }
  return { type: body.type, payload: body.payload };
}

export function renderGguiSurface(intent) {
  const normalizedIntent = normalizeIntent(intent);
  if (normalizedIntent.type === "image.gallery") {
    return buildImageGallerySurface(normalizedIntent.payload);
  }
  if (normalizedIntent.type === "comparison.table") {
    return buildComparisonTableSurface(normalizedIntent.payload);
  }
  throw unsupportedTypeError(normalizedIntent.type);
}

function normalizeIntent(intent) {
  if (!isPlainObject(intent)) {
    throw gguiRenderValidationError("intent must be a JSON object", { path: "$.intent" });
  }
  const rawType = typeof intent.type === "string" ? intent.type.trim() : "";
  if (!rawType) {
    throw gguiRenderValidationError("intent type is required", { path: "$.intent.type" });
  }
  const normalizedType = SUPPORTED_INTENT_TYPES.get(rawType);
  if (!normalizedType) throw unsupportedTypeError(rawType);
  const payload = intent.payload ?? {};
  if (!isPlainObject(payload)) {
    throw gguiRenderValidationError("intent payload must be a JSON object", { path: "$.intent.payload" });
  }
  return { type: normalizedType, payload };
}

function buildImageGallerySurface(payload) {
  const title = requireNonEmptyString(payload.title, "$.intent.payload.title");
  const rawImages = payload.images;
  if (!Array.isArray(rawImages)) {
    throw gguiRenderValidationError("image gallery images must be an array", {
      path: "$.intent.payload.images"
    });
  }
  const images = rawImages.map((image, index) => normalizeImage(image, index));
  const sourceUrl = optionalString(payload.sourceUrl, "$.intent.payload.sourceUrl");
  return {
    type: "image.gallery",
    kind: "imageGallery",
    title,
    sourceUrl,
    images
  };
}

function buildComparisonTableSurface(payload) {
  if (!Array.isArray(payload.columns) || payload.columns.length === 0) {
    throw gguiRenderValidationError("comparison table columns must be a non-empty array", {
      path: "$.intent.payload.columns"
    });
  }
  if (!Array.isArray(payload.items)) {
    throw gguiRenderValidationError("comparison table items must be an array", {
      path: "$.intent.payload.items"
    });
  }
  const columns = payload.columns.map((column, index) => normalizeColumn(column, index));
  const title = optionalString(payload.title, "$.intent.payload.title");
  const items = payload.items.map((item, index) => {
    if (!isPlainObject(item)) {
      throw gguiRenderValidationError("comparison table items must be objects", {
        path: `$.intent.payload.items[${index}]`
      });
    }
    return item;
  });
  return {
    type: "comparison.table",
    kind: "comparisonTable",
    ...(title ? { title } : {}),
    columns,
    items
  };
}

function normalizeImage(image, index) {
  if (!isPlainObject(image)) {
    throw gguiRenderValidationError("image entries must be objects", {
      path: `$.intent.payload.images[${index}]`
    });
  }
  const url = requireNonEmptyString(image.url, `$.intent.payload.images[${index}].url`);
  const caption = optionalString(image.caption, `$.intent.payload.images[${index}].caption`);
  const source = optionalString(image.source || image.sourceUrl, `$.intent.payload.images[${index}].source`);
  return {
    url,
    ...(caption ? { caption } : {}),
    ...(source ? { source } : {})
  };
}

function normalizeColumn(column, index) {
  if (typeof column === "string") {
    const key = column.trim();
    if (!key) {
      throw gguiRenderValidationError("comparison table column string must be non-empty", {
        path: `$.intent.payload.columns[${index}]`
      });
    }
    return { key, label: key };
  }
  if (!isPlainObject(column)) {
    throw gguiRenderValidationError("comparison table columns must be strings or objects", {
      path: `$.intent.payload.columns[${index}]`
    });
  }
  const key = requireNonEmptyString(column.key, `$.intent.payload.columns[${index}].key`);
  const label = optionalString(column.label, `$.intent.payload.columns[${index}].label`) || key;
  return { key, label };
}

function requireNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw gguiRenderValidationError("value must be a non-empty string", { path });
  }
  return value.trim();
}

function optionalString(value, path) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw gguiRenderValidationError("value must be a non-empty string", { path });
  }
  return value.trim();
}

function unsupportedTypeError(type) {
  return gguiRenderValidationError(`unsupported ggui intent type: ${type}`, {
    path: "$.intent.type",
    type,
    supportedTypes: [...SUPPORTED_INTENT_TYPES.keys()]
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
