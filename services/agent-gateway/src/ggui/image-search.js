import { renderGguiSurface } from "./render.js";
import { GguiRenderError } from "./errors.js";

const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";

export async function searchImageGallerySurface({
  query,
  title,
  limit = 4,
  fetchImpl = fetch
} = {}) {
  const result = await searchImageResults({
    query,
    limit,
    fetchImpl
  });
  return renderGguiSurface({
    type: "image.gallery",
    payload: {
      title: title || result.query,
      sourceUrl: result.sourceUrl,
      images: result.images
    }
  });
}

export async function searchImageResults({
  query,
  limit = 4,
  fetchImpl = fetch
} = {}) {
  const searchQuery = normalizeSearchQuery(query);
  const photoLimit = normalizeLimit(limit);
  const url = commonsSearchUrl(searchQuery, photoLimit);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "User-Agent": "oba-agent-local-dev/0.1"
    }
  });
  if (!response.ok) {
    throw new GguiRenderError(`image search failed with HTTP ${response.status}`, {
      code: "GGUI_IMAGE_SEARCH_FAILED",
      status: 502,
      data: { status: response.status, source: "wikimedia-commons" }
    });
  }
  const body = await response.json();
  const photos = commonsPagesToPhotos(body);
  if (photos.length === 0) {
    throw new GguiRenderError("image search returned no usable photos", {
      code: "GGUI_IMAGE_SEARCH_EMPTY",
      status: 404,
      data: { query: searchQuery, source: "wikimedia-commons" }
    });
  }
  return {
    query: searchQuery,
    source: "wikimedia-commons",
    sourceUrl: commonsSearchPageUrl(searchQuery),
    images: photos
  };
}

function commonsSearchUrl(query, limit) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    origin: "*"
  });
  return `${COMMONS_API_URL}?${params.toString()}`;
}

function commonsSearchPageUrl(query) {
  const params = new URLSearchParams({ search: query, title: "Special:MediaSearch", type: "image" });
  return `https://commons.wikimedia.org/wiki/Special:MediaSearch?${params.toString()}`;
}

function commonsPagesToPhotos(body) {
  const pages = Object.values(body?.query?.pages || {});
  return pages
    .map((page) => {
      const imageInfo = page?.imageinfo?.[0];
      if (!imageInfo?.url || !imageInfo?.descriptionurl) return null;
      return {
        url: imageInfo.url,
        caption: cleanText(
          imageInfo.extmetadata?.ImageDescription?.value
            || imageInfo.extmetadata?.ObjectName?.value
            || page.title
        ),
        source: imageInfo.descriptionurl
      };
    })
    .filter(Boolean);
}

function normalizeSearchQuery(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new GguiRenderError("image search query must be a non-empty string", {
      code: "GGUI_IMAGE_SEARCH_QUERY_REQUIRED",
      status: 400
    });
  }
  return value.trim();
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) return 4;
  return parsed;
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]+>/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}
