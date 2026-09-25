import { fetchJson, safeHttpsUrl, validBaseUrl } from "./api.js";

export const ANIAPI_DEFAULT = "https://api.aniapi.com";
export const ANIMEPARADISE_DEFAULT = "https://api.animeparadise.moe";
export const PROVIDERS = {
  animeparadise: { label: "AnimeParadise" },
  aniapi: { label: "AniAPI" },
};
const FORMATS = { tv: 0, movie: 2, special: 3, ova: 4, ona: 5 };
const FORMAT_NAMES = [
  "TV",
  "TV Short",
  "Movie",
  "Special",
  "OVA",
  "ONA",
  "Music",
];
const STATUS_NAMES = ["Finished", "Releasing", "Not yet released", "Cancelled"];

function normalizeAnime(anime, baseUrl) {
  const id = String(anime.id);
  const trailer =
    /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(
      anime.trailer_url || "",
    );
  const score = Number(anime.score);
  return {
    key: `aniapi:${id}`,
    provider: "aniapi",
    id,
    title:
      anime.titles?.en ||
      anime.titles?.rj ||
      anime.titles?.jp ||
      "Untitled anime",
    image: safeHttpsUrl(anime.cover_image),
    score: anime.score == null || !Number.isFinite(score) ? null : score / 10,
    type: FORMAT_NAMES[anime.format] || "Unknown",
    year: anime.season_year || anime.start_date?.slice(0, 4) || "",
    status: STATUS_NAMES[anime.status] || "",
    description: anime.descriptions?.en || "",
    trailerId: trailer?.[1] || "",
    url: `${validBaseUrl(baseUrl)}/v1/anime/${encodeURIComponent(id)}`,
  };
}

function normalizeWatchableAnime(anime) {
  const id = String(anime._id);
  const rating = Number(anime.rate);
  return {
    key: `animeparadise:${id}`,
    provider: "animeparadise",
    id,
    title: anime.alternativeTitle?.english || anime.title || "Untitled anime",
    image: safeHttpsUrl(anime.posterImage?.large || anime.posterImage?.medium),
    score: anime.rate == null || !Number.isFinite(rating) ? null : rating / 10,
    type: "Anime",
    year: anime.animeSeason?.year || anime.startDate?.slice(0, 4) || "",
    status: "",
    description: "",
    trailerId: "",
    episodesCount: Number(anime.episodes) || 0,
    url: anime.link
      ? `https://www.animeparadise.moe/anime/${encodeURIComponent(anime.link)}`
      : "https://www.animeparadise.moe/",
  };
}

/** Fetch a page of AniAPI catalog records. */
export async function fetchAnime({
  provider = "animeparadise",
  query = "",
  type = "all",
  page = 1,
  signal,
  baseUrl,
}) {
  if (provider === "animeparadise") {
    const params = new URLSearchParams({
      q: query,
      limit: "20",
      page: String(page),
    });
    const response = await fetchJson(
      baseUrl || ANIMEPARADISE_DEFAULT,
      `/search?${params}`,
      signal,
    );
    if (!response.success || !Array.isArray(response.data))
      throw new Error(
        response.error ||
          "AnimeParadise returned an unexpected catalog response.",
      );
    return {
      items: response.data
        .filter((item) => item?._id && Number(item.episodes) > 0)
        .map(normalizeWatchableAnime),
      hasMore: Boolean(response.pagination?.hasNext),
    };
  }
  if (provider !== "aniapi") throw new Error("Unknown anime catalog.");
  const params = new URLSearchParams({
    page: String(page),
    per_page: "20",
    nsfw: "false",
  });
  if (query) params.set("title", query);
  if (type !== "all") {
    if (!(type in FORMATS)) throw new Error("Unknown anime format.");
    params.set("formats", String(FORMATS[type]));
  }
  const response = await fetchJson(
    baseUrl || ANIAPI_DEFAULT,
    `/v1/anime?${params}`,
    signal,
  );
  if (response.status_code && response.status_code !== 200)
    throw new Error(
      response.message || `AniAPI returned ${response.status_code}.`,
    );
  const data = response.data;
  if (!data || !Array.isArray(data.documents))
    throw new Error("AniAPI returned an unexpected catalog response.");
  return {
    items: data.documents
      .filter((item) => item && item.id != null)
      .map((item) => normalizeAnime(item, baseUrl || ANIAPI_DEFAULT)),
    hasMore: Number(data.current_page) < Number(data.last_page),
  };
}
