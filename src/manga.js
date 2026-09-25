import { fetchJson, safeHttpsUrl, validBaseUrl } from "./api.js?v=20260925-1";

const API = "https://api.mangadex.org";
export const MANGA_API_STORAGE = "aniwatch:manga-api-url";
export function mangaApiUrl() {
  try {
    return validBaseUrl(localStorage.getItem(MANGA_API_STORAGE) || "") || API;
  } catch {
    return API;
  }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function titleOf(attributes = {}) {
  const titles = attributes.title || {};
  const english = attributes.altTitles?.find((item) => item.en)?.en;
  return (
    titles.en ||
    english ||
    titles["ja-ro"] ||
    titles["ko-ro"] ||
    Object.values(titles)[0] ||
    "Untitled manga"
  );
}

export function normalizeManga(item) {
  if (!UUID.test(item?.id || "")) return null;
  const attributes = item.attributes || {};
  const cover = item.relationships?.find((entry) => entry.type === "cover_art")
    ?.attributes?.fileName;
  const description =
    attributes.description?.en ||
    Object.values(attributes.description || {})[0] ||
    "No description available.";
  return {
    id: item.id,
    title: titleOf(attributes),
    description: String(description)
      .replace(/\[[^\]]+\]\([^)]*\)/g, "")
      .trim(),
    year: attributes.year || "",
    status: attributes.status || "",
    cover: cover
      ? `https://uploads.mangadex.org/covers/${item.id}/${encodeURIComponent(cover)}.256.jpg`
      : "",
    url: `https://mangadex.org/title/${item.id}`,
  };
}

export async function fetchManga(query = "", offset = 0, signal) {
  const params = new URLSearchParams({ limit: "20", offset: String(offset) });
  params.append("includes[]", "cover_art");
  params.append("contentRating[]", "safe");
  params.append("contentRating[]", "suggestive");
  if (query) params.set("title", query);
  else params.set("order[followedCount]", "desc");
  const result = await fetchJson(mangaApiUrl(), `/manga?${params}`, signal);
  if (result.result !== "ok" || !Array.isArray(result.data))
    throw new Error("MangaDex returned an unexpected catalog response.");
  return {
    items: result.data.map(normalizeManga).filter(Boolean),
    total: result.total || 0,
    offset,
  };
}

export function normalizeChapter(item) {
  if (!UUID.test(item?.id || "")) return null;
  const a = item.attributes || {};
  return {
    id: item.id,
    label: `Ch. ${a.chapter || "?"}${a.title ? ` · ${a.title}` : ""}`,
    pages: Number(a.pages) || 0,
    externalUrl: safeHttpsUrl(a.externalUrl || ""),
  };
}

export async function fetchChapters(mangaId, offset = 0, signal) {
  if (!UUID.test(mangaId)) throw new Error("Invalid manga ID.");
  const params = new URLSearchParams({ limit: "100", offset: String(offset) });
  params.append("translatedLanguage[]", "en");
  params.set("order[chapter]", "asc");
  const result = await fetchJson(
    mangaApiUrl(),
    `/manga/${mangaId}/feed?${params}`,
    signal,
  );
  if (result.result !== "ok" || !Array.isArray(result.data))
    throw new Error("MangaDex returned an unexpected chapter response.");
  return {
    items: result.data
      .map(normalizeChapter)
      .filter((item) => item && (item.pages > 0 || item.externalUrl)),
    total: result.total || 0,
    nextOffset: offset + result.data.length,
  };
}

export async function fetchChapterPages(
  chapterId,
  quality = "data-saver",
  signal,
) {
  if (!UUID.test(chapterId)) throw new Error("Invalid chapter ID.");
  const result = await fetchJson(
    mangaApiUrl(),
    `/at-home/server/${chapterId}`,
    signal,
  );
  const base = safeHttpsUrl(result.baseUrl);
  const hash = result.chapter?.hash;
  const files =
    result.chapter?.[quality === "data-saver" ? "dataSaver" : "data"];
  if (
    !base ||
    !/^[a-f0-9]+$/i.test(hash || "") ||
    !Array.isArray(files) ||
    !files.length
  )
    throw new Error(
      "This chapter has no readable pages. Try another chapter or open it on MangaDex.",
    );
  return files.map((file) => {
    if (!/^[\w.-]+$/.test(file))
      throw new Error("MangaDex returned an invalid page name.");
    return `${base.replace(/\/$/, "")}/${quality}/${hash}/${file}`;
  });
}
