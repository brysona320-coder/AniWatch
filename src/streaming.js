import { fetchJson, safeHttpsUrl } from "./api.js?v=20260925-6";

export const CONSUMET_DEFAULT = "https://api.consumet.org";
export const ANIMEPARADISE_DEFAULT = "https://api.animeparadise.moe";
const ANIMEPARADISE_STREAM = "https://stream.animeparadise.moe";
export const STREAM_PROVIDERS = {
  animeparadise: "AnimeParadise",
  animekai: "AnimeKai",
  animepahe: "Animepahe",
};

function checkProvider(provider) {
  if (!(provider in STREAM_PROVIDERS))
    throw new Error("Unknown streaming source.");
}

function matchRank(title, query) {
  const normalize = (value) =>
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const name = normalize(title);
  const search = normalize(query);
  return name === search ? 0 : name.startsWith(`${search} `) ? 1 : 2;
}

export async function searchStreams({ baseUrl, provider, query, signal }) {
  checkProvider(provider);
  if (provider === "animeparadise") {
    const params = new URLSearchParams({ q: query, limit: "20" });
    const data = await fetchJson(
      baseUrl || ANIMEPARADISE_DEFAULT,
      `/search?${params}`,
      signal,
    );
    if (!data.success || !Array.isArray(data.data))
      throw new Error(
        data.error || "AnimeParadise returned an unexpected search response.",
      );
    return data.data
      .filter((item) => item?._id && Number(item.episodes) > 0)
      .map((item) => ({
        id: String(item._id),
        title: item.alternativeTitle?.english || item.title || "Untitled anime",
        image: safeHttpsUrl(item.posterImage?.medium),
        url: item.link
          ? `https://www.animeparadise.moe/anime/${encodeURIComponent(item.link)}`
          : "",
        releaseDate: item.animeSeason?.year || "",
        subOrDub: "sub",
      }))
      .sort((a, b) => matchRank(a.title, query) - matchRank(b.title, query));
  }
  const data = await fetchJson(
    baseUrl || CONSUMET_DEFAULT,
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
  baseUrl,
  provider,
  id,
  episodePage = 1,
  signal,
}) {
  checkProvider(provider);
  if (provider === "animeparadise") {
    const data = await fetchJson(
      baseUrl || ANIMEPARADISE_DEFAULT,
      `/anime/${encodeURIComponent(id)}/episode`,
      signal,
    );
    if (!data.success || !Array.isArray(data.data))
      throw new Error(data.error || "AnimeParadise returned no episode list.");
    return {
      title: "",
      totalEpisodes: data.data.length,
      episodes: data.data
        .filter((episode) => episode?.uid)
        .map((episode) => ({
          id: `${episode.uid}:${id}`,
          number: episode.number ?? "?",
          title: episode.title || "",
        })),
    };
  }
  const path =
    provider === "animekai"
      ? `/anime/animekai/info?id=${encodeURIComponent(id)}`
      : `/anime/animepahe/info/${encodeURIComponent(id)}?episodePage=${episodePage}`;
  const data = await fetchJson(baseUrl || CONSUMET_DEFAULT, path, signal);
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
  baseUrl,
  provider,
  episodeId,
  signal,
}) {
  checkProvider(provider);
  if (provider === "animeparadise") {
    const divider = episodeId.lastIndexOf(":");
    if (divider < 1) throw new Error("Invalid AnimeParadise episode ID.");
    const uid = episodeId.slice(0, divider);
    const origin = episodeId.slice(divider + 1);
    const data = await fetchJson(
      baseUrl || ANIMEPARADISE_DEFAULT,
      `/ep/${encodeURIComponent(uid)}?origin=${encodeURIComponent(origin)}`,
      signal,
    );
    const link = data.data?.episode?.streamLink;
    if (!data.success || !link)
      throw new Error(
        data.error || "AnimeParadise returned no video for this episode.",
      );
    return {
      needsHeaders: false,
      sources: [
        {
          url: `${ANIMEPARADISE_STREAM}/m3u8?url=${encodeURIComponent(link)}`,
          quality: "Auto",
          hls: true,
        },
      ],
    };
  }
  const path =
    provider === "animekai"
      ? `/anime/animekai/watch/${encodeURIComponent(episodeId)}`
      : `/anime/animepahe/watch?episodeId=${encodeURIComponent(episodeId)}`;
  const data = await fetchJson(baseUrl || CONSUMET_DEFAULT, path, signal);
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
