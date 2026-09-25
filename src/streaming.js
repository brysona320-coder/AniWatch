import { fetchJson, safeHttpsUrl } from "./api.js";

export const CONSUMET_DEFAULT = "https://api.consumet.org";
export const STREAM_PROVIDERS = {
  animekai: "AnimeKai",
  animepahe: "Animepahe",
};

function checkProvider(provider) {
  if (!(provider in STREAM_PROVIDERS))
    throw new Error("Unknown streaming source.");
}

export async function searchStreams({
  baseUrl = CONSUMET_DEFAULT,
  provider,
  query,
  signal,
}) {
  checkProvider(provider);
  const data = await fetchJson(
    baseUrl,
    `/anime/${provider}/${encodeURIComponent(query)}`,
    signal,
  );
  if (!Array.isArray(data.results))
    throw new Error("Consumet returned an unexpected search response.");
  return data.results
    .filter((item) => item?.id && item?.title)
    .map((item) => ({
      id: String(item.id),
      title: String(item.title),
      image: safeHttpsUrl(item.image),
      releaseDate: item.releaseDate || "",
      subOrDub: item.subOrDub || "",
    }));
}

export async function getStreamInfo({
  baseUrl = CONSUMET_DEFAULT,
  provider,
  id,
  episodePage = 1,
  signal,
}) {
  checkProvider(provider);
  const path =
    provider === "animekai"
      ? `/anime/animekai/info?id=${encodeURIComponent(id)}`
      : `/anime/animepahe/info/${encodeURIComponent(id)}?episodePage=${episodePage}`;
  const data = await fetchJson(baseUrl, path, signal);
  if (!Array.isArray(data.episodes))
    throw new Error("Consumet returned no episode list for this title.");
  return {
    title: String(data.title || ""),
    totalEpisodes: Number(data.totalEpisodes) || data.episodes.length,
    episodes: data.episodes
      .filter((episode) => episode?.id)
      .map((episode) => ({
        id: String(episode.id),
        number: episode.number ?? "?",
        title: episode.title || "",
      })),
  };
}

export async function getEpisodeSources({
  baseUrl = CONSUMET_DEFAULT,
  provider,
  episodeId,
  signal,
}) {
  checkProvider(provider);
  const path =
    provider === "animekai"
      ? `/anime/animekai/watch/${encodeURIComponent(episodeId)}`
      : `/anime/animepahe/watch?episodeId=${encodeURIComponent(episodeId)}`;
  const data = await fetchJson(baseUrl, path, signal);
  if (!Array.isArray(data.sources))
    throw new Error("Consumet returned no video sources for this episode.");
  return {
    needsHeaders: Boolean(
      data.headers && Object.values(data.headers).some(Boolean),
    ),
    sources: data.sources
      .filter((source) => safeHttpsUrl(source?.url))
      .map((source) => ({
        url: safeHttpsUrl(source.url),
        quality: String(source.quality || "Auto"),
        hls: Boolean(source.isM3U8 || /\.m3u8(?:\?|$)/i.test(source.url)),
      })),
  };
}
