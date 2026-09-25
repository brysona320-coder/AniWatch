import { fetchJson, safeHttpsUrl, validBaseUrl } from "./api.js?v=20260925-6";

export const ANIAPI_DEFAULT = "https://api.aniapi.com";
export const ANIMEPARADISE_DEFAULT = "https://api.animeparadise.moe";
export const PROVIDERS = {
  animeparadise: { label: "AnimeParadise" },
  anilist: { label: "AniList" },
  kitsu: { label: "Kitsu" },
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
const ANILIST_QUERY = `query AnimeCatalog($page: Int!, $search: String, $format: MediaFormat, $sort: [MediaSort]) {
  Page(page: $page, perPage: 20) {
    pageInfo { hasNextPage }
    media(type: ANIME, search: $search, format: $format, sort: $sort, isAdult: false) {
      id title { english romaji native } coverImage { extraLarge large }
      averageScore format seasonYear status description trailer { id site }
    }
  }
}`;

function cleanTrailerId(value) {
  return /^[\w-]{11}$/.test(value || "") ? value : "";
}

function fromAniList(anime) {
  return {
    key: `anilist:${anime.id}`,
    provider: "anilist",
    id: String(anime.id),
    title:
      anime.title?.english ||
      anime.title?.romaji ||
      anime.title?.native ||
      "Untitled anime",
    image: safeHttpsUrl(
      anime.coverImage?.extraLarge || anime.coverImage?.large,
    ),
    score:
      anime.averageScore == null
        ? null
        : Number((anime.averageScore / 10).toFixed(1)),
    type: anime.format || "Unknown",
    year: anime.seasonYear || "",
    status: anime.status?.replaceAll("_", " ") || "",
    description: anime.description || "",
    trailerId:
      anime.trailer?.site?.toLowerCase() === "youtube"
        ? cleanTrailerId(anime.trailer.id)
        : "",
    url: `https://anilist.co/anime/${encodeURIComponent(anime.id)}`,
  };
}

function fromKitsu(anime) {
  const details = anime.attributes || {};
  return {
    key: `kitsu:${anime.id}`,
    provider: "kitsu",
    id: String(anime.id),
    title: details.titles?.en || details.canonicalTitle || "Untitled anime",
    image: safeHttpsUrl(
      details.posterImage?.large || details.posterImage?.medium,
    ),
    score:
      details.averageRating == null
        ? null
        : Number((Number(details.averageRating) / 10).toFixed(1)),
    type: details.subtype || "Unknown",
    year: details.startDate?.slice(0, 4) || "",
    status: details.status || "",
    description: details.synopsis || "",
    trailerId: cleanTrailerId(details.youtubeVideoId),
    url: `https://kitsu.io/anime/${encodeURIComponent(anime.id)}`,
  };
}

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
  if (provider === "anilist") {
    const variables = { page, sort: [query ? "SEARCH_MATCH" : "SCORE_DESC"] };
    if (query) variables.search = query;
    if (type !== "all") variables.format = type.toUpperCase();
    const response = await fetchJson("https://graphql.anilist.co", "", signal, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: ANILIST_QUERY, variables }),
    });
    if (response.errors?.length)
      throw new Error(
        response.errors[0].message || "AniList could not return results.",
      );
    if (!Array.isArray(response.data?.Page?.media))
      throw new Error("AniList returned an unexpected catalog response.");
    return {
      items: response.data.Page.media.map(fromAniList),
      hasMore: Boolean(response.data.Page.pageInfo?.hasNextPage),
    };
  }
  if (provider === "kitsu") {
    const params = new URLSearchParams({
      "page[limit]": "20",
      "page[offset]": String((page - 1) * 20),
      sort: "-averageRating",
    });
    if (query) params.set("filter[text]", query);
    if (type !== "all") params.set("filter[subtype]", type);
    const response = await fetchJson(
      "https://kitsu.io",
      `/api/edge/anime?${params}`,
      signal,
      { headers: { Accept: "application/vnd.api+json" } },
    );
    if (response.errors?.length)
      throw new Error(
        response.errors[0].detail || "Kitsu could not return results.",
      );
    if (!Array.isArray(response.data))
      throw new Error("Kitsu returned an unexpected catalog response.");
    return {
      items: response.data.map(fromKitsu),
      hasMore: Boolean(response.links?.next),
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
