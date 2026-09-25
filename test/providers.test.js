import test from "node:test";
import assert from "node:assert/strict";
import { fetchAnime } from "../src/providers.js";

async function withFetch(reply, check) {
  const original = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return { ok: true, json: async () => reply };
  };
  try {
    await check(() => request);
  } finally {
    globalThis.fetch = original;
  }
}

test("Jikan search sends its filter and normalizes results", async () => {
  await withFetch(
    {
      data: [
        {
          mal_id: 42,
          title: "Example",
          type: "Movie",
          score: 8.3,
          images: {
            jpg: { large_image_url: "https://example.com/poster.jpg" },
          },
        },
      ],
      pagination: { has_next_page: true },
    },
    async (request) => {
      const result = await fetchAnime({
        provider: "jikan",
        query: "a & b",
        type: "movie",
        page: 2,
      });
      const url = new URL(request().url);
      assert.equal(url.pathname, "/v4/anime");
      assert.equal(url.searchParams.get("q"), "a & b");
      assert.equal(url.searchParams.get("type"), "movie");
      assert.equal(url.searchParams.get("page"), "2");
      assert.equal(result.items[0].key, "jikan:42");
      assert.equal(result.items[0].score, 8.3);
      assert.equal(result.hasMore, true);
    },
  );
});

test("AniList query uses search format and converts its 100-point score", async () => {
  await withFetch(
    {
      data: {
        Page: {
          pageInfo: { hasNextPage: false },
          media: [
            {
              id: 7,
              title: { romaji: "Sample" },
              averageScore: 87,
              format: "TV",
              trailer: { site: "youtube", id: "abcdefghijk" },
            },
          ],
        },
      },
    },
    async (request) => {
      const result = await fetchAnime({
        provider: "anilist",
        query: "sample",
        type: "tv",
        page: 1,
      });
      const body = JSON.parse(request().options.body);
      assert.equal(request().options.method, "POST");
      assert.equal(body.variables.search, "sample");
      assert.equal(body.variables.format, "TV");
      assert.deepEqual(body.variables.sort, ["SEARCH_MATCH"]);
      assert.equal(result.items[0].key, "anilist:7");
      assert.equal(result.items[0].score, 8.7);
      assert.equal(result.items[0].trailerId, "abcdefghijk");
    },
  );
});

test("AniList omits unused optional filters for its top list", async () => {
  await withFetch(
    { data: { Page: { pageInfo: { hasNextPage: true }, media: [] } } },
    async (request) => {
      await fetchAnime({ provider: "anilist", page: 1 });
      const variables = JSON.parse(request().options.body).variables;
      assert.deepEqual(variables, { page: 1, sort: ["SCORE_DESC"] });
    },
  );
});

test("Kitsu paginates with offsets and keeps provider IDs distinct", async () => {
  await withFetch(
    {
      data: [
        {
          id: "42",
          attributes: {
            canonicalTitle: "Another anime",
            subtype: "movie",
            averageRating: "89.0",
            posterImage: { large: "http://insecure.test/image.jpg" },
            youtubeVideoId: "invalid",
          },
        },
      ],
      links: { next: "https://kitsu.io/next" },
    },
    async (request) => {
      const result = await fetchAnime({
        provider: "kitsu",
        query: "another",
        type: "movie",
        page: 3,
      });
      const url = new URL(request().url);
      assert.equal(url.searchParams.get("page[offset]"), "40");
      assert.equal(url.searchParams.get("filter[text]"), "another");
      assert.equal(url.searchParams.get("filter[subtype]"), "movie");
      assert.equal(result.items[0].key, "kitsu:42");
      assert.equal(result.items[0].score, 8.9);
      assert.equal(result.items[0].image, "");
      assert.equal(result.items[0].trailerId, "");
      assert.equal(result.items[0].url, "https://kitsu.io/anime/42");
      assert.equal(result.hasMore, true);
    },
  );
});

test("rate limit errors are actionable", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  try {
    await assert.rejects(fetchAnime({ provider: "jikan" }), /rate limited/);
  } finally {
    globalThis.fetch = original;
  }
});

test("server errors suggest selecting another source", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 504 });
  try {
    await assert.rejects(
      fetchAnime({ provider: "jikan" }),
      /Try another source/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
