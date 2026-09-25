const PAGE_SIZE = 20;

async function readJson(response) {
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "This source is rate limited. Try again shortly or choose another source.",
      );
    }
    if (response.status >= 500) {
      throw new Error(
        "This source is temporarily unavailable. Try another source or come back shortly.",
      );
    }
    throw new Error(`This source returned HTTP ${response.status}.`);
  }
  return response.json();
}

function safeImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function cleanTrailerId(value) {
  return /^[\w-]{11}$/.test(value || "") ? value : "";
}

function fromJikan(anime) {
  return {
    key: `jikan:${anime.mal_id}`,
    provider: "jikan",
    id: String(anime.mal_id),
    title: anime.title_english || anime.title || "Untitled anime",
    image: safeImage(
      anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url,
    ),
    score: anime.score == null ? null : Number(anime.score),
    type: anime.type || "Unknown",
    year: anime.year || anime.aired?.from?.slice(0, 4) || "",
    status: anime.status || "",
    description: anime.synopsis || "",
    trailerId: cleanTrailerId(anime.trailer?.youtube_id),
    url: `https://myanimelist.net/anime/${anime.mal_id}`,
  };
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
    image: safeImage(anime.coverImage?.extraLarge || anime.coverImage?.large),
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
    url: `https://anilist.co/anime/${anime.id}`,
  };
}

function fromKitsu(anime) {
  const details = anime.attributes || {};
  return {
    key: `kitsu:${anime.id}`,
    provider: "kitsu",
    id: String(anime.id),
    title: details.titles?.en || details.canonicalTitle || "Untitled anime",
    image: safeImage(details.posterImage?.large || details.posterImage?.medium),
    score:
      details.averageRating == null
        ? null
        : Number((Number(details.averageRating) / 10).toFixed(1)),
    type: details.subtype || "Unknown",
    year: details.startDate?.slice(0, 4) || "",
    status: details.status || "",
    description: details.synopsis || "",
    trailerId: cleanTrailerId(details.youtubeVideoId),
    url: `https://kitsu.io/anime/${anime.id}`,
  };
}

const ANILIST_QUERY = `query AnimeCatalog($page: Int!, $search: String, $format: MediaFormat, $sort: [MediaSort]) {
  Page(page: $page, perPage: 20) {
    pageInfo { hasNextPage }
    media(type: ANIME, search: $search, format: $format, sort: $sort, isAdult: false) {
      id title { english romaji native } coverImage { extraLarge large }
      averageScore format seasonYear status description trailer { id site }
    }
  }
}`;

export const PROVIDERS = {
  jikan: { label: "Jikan" },
  anilist: { label: "AniList" },
  kitsu: { label: "Kitsu" },
};

/** Return one page in the same shape regardless of source. */
export async function fetchAnime({
  provider,
  query = "",
  type = "all",
  page = 1,
  signal,
}) {
  if (!PROVIDERS[provider]) throw new Error("Unknown anime source.");

  if (provider === "jikan") {
    const path = query ? "/anime" : "/top/anime";
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(page),
    });
    if (query) params.set("q", query);
    if (type !== "all") params.set("type", type);
    const data = await readJson(
      await fetch(`https://api.jikan.moe/v4${path}?${params}`, { signal }),
    );
    return {
      items: (data.data || []).map(fromJikan),
      hasMore: Boolean(data.pagination?.has_next_page),
    };
  }

  if (provider === "anilist") {
    const variables = { page, sort: [query ? "SEARCH_MATCH" : "SCORE_DESC"] };
    if (query) variables.search = query;
    if (type !== "all") variables.format = type.toUpperCase();
    const data = await readJson(
      await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: ANILIST_QUERY, variables }),
        signal,
      }),
    );
    if (data.errors?.length)
      throw new Error(
        data.errors[0].message || "AniList could not return results.",
      );
    return {
      items: (data.data?.Page?.media || []).map(fromAniList),
      hasMore: Boolean(data.data?.Page?.pageInfo?.hasNextPage),
    };
  }

  const params = new URLSearchParams({
    "page[limit]": String(PAGE_SIZE),
    "page[offset]": String((page - 1) * PAGE_SIZE),
    sort: "-averageRating",
  });
  if (query) params.set("filter[text]", query);
  if (type !== "all") params.set("filter[subtype]", type);
  const data = await readJson(
    await fetch(`https://kitsu.io/api/edge/anime?${params}`, {
      headers: { Accept: "application/vnd.api+json" },
      signal,
    }),
  );
  if (data.errors?.length)
    throw new Error(data.errors[0].detail || "Kitsu could not return results.");
  return {
    items: (data.data || []).map(fromKitsu),
    hasMore: Boolean(data.links?.next),
  };
}
