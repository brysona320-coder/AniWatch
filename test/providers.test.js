import test from "node:test";
import assert from "node:assert/strict";
import { fetchAnime } from "../src/providers.js";
import { validBaseUrl } from "../src/api.js";

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

test("AniAPI search maps filters, pagination, and catalog data", async () => {
  await withFetch(
    {
      status_code: 200,
      data: {
        current_page: 2,
        last_page: 3,
        documents: [
          {
            id: 42,
            titles: { en: "Example" },
            descriptions: { en: "Story" },
            format: 2,
            status: 0,
            score: 83,
            season_year: 2024,
            cover_image: "https://example.com/poster.jpg",
          },
        ],
      },
    },
    async (request) => {
      const result = await fetchAnime({
        provider: "aniapi",
        baseUrl: "https://aniapi.example/api",
        query: "a & b",
        type: "movie",
        page: 2,
      });
      const url = new URL(request().url);
      assert.equal(url.pathname, "/api/v1/anime");
      assert.equal(url.searchParams.get("title"), "a & b");
      assert.equal(url.searchParams.get("formats"), "2");
      assert.equal(url.searchParams.get("nsfw"), "false");
      assert.equal(url.searchParams.get("page"), "2");
      assert.equal(result.items[0].key, "aniapi:42");
      assert.equal(result.items[0].score, 8.3);
      assert.equal(result.items[0].type, "Movie");
      assert.equal(
        result.items[0].url,
        "https://aniapi.example/api/v1/anime/42",
      );
      assert.equal(result.hasMore, true);
    },
  );
});

test("AniAPI response errors and wrong response shapes are reported", async () => {
  await withFetch(
    { status_code: 429, message: "Too many requests" },
    async () => {
      await assert.rejects(
        fetchAnime({ provider: "aniapi" }),
        /Too many requests/,
      );
    },
  );
  await withFetch({ data: [] }, async () => {
    await assert.rejects(
      fetchAnime({ provider: "aniapi" }),
      /unexpected catalog response/,
    );
  });
});

test("default catalog includes only AnimeParadise titles with episodes", async () => {
  await withFetch(
    {
      success: true,
      data: [
        {
          _id: "show-1",
          title: "Sample",
          episodes: 12,
          rate: "84.5",
          posterImage: { large: "https://example.com/cover.jpg" },
          animeSeason: { year: 2024 },
          link: "sample",
        },
        { _id: "show-2", title: "Unavailable", episodes: 0 },
      ],
      pagination: { hasNext: true },
    },
    async (request) => {
      const result = await fetchAnime({ page: 2, query: "Sample" });
      const url = new URL(request().url);
      assert.equal(url.host, "api.animeparadise.moe");
      assert.equal(url.pathname, "/search");
      assert.equal(url.searchParams.get("q"), "Sample");
      assert.equal(url.searchParams.get("page"), "2");
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].key, "animeparadise:show-1");
      assert.equal(result.items[0].score, 8.45);
      assert.equal(result.items[0].episodesCount, 12);
      assert.equal(result.hasMore, true);
    },
  );
});

test("AniList searches by title and format through its browser API", async () => {
  await withFetch(
    {
      data: {
        Page: {
          pageInfo: { hasNextPage: true },
          media: [
            {
              id: 7,
              title: { romaji: "Sample" },
              averageScore: 87,
              format: "TV",
            },
          ],
        },
      },
    },
    async (request) => {
      const result = await fetchAnime({
        provider: "anilist",
        query: "Sample",
        type: "tv",
        page: 2,
      });
      assert.equal(request().url, "https://graphql.anilist.co");
      assert.equal(request().options.method, "POST");
      const variables = JSON.parse(request().options.body).variables;
      assert.deepEqual(variables, {
        page: 2,
        sort: ["SEARCH_MATCH"],
        search: "Sample",
        format: "TV",
      });
      assert.equal(result.items[0].key, "anilist:7");
      assert.equal(result.items[0].score, 8.7);
      assert.equal(result.hasMore, true);
    },
  );
});

test("Kitsu sends its required media type and paginates by offset", async () => {
  await withFetch(
    {
      data: [
        {
          id: "42",
          attributes: {
            canonicalTitle: "Another anime",
            averageRating: "89.0",
            subtype: "movie",
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
      assert.equal(url.pathname, "/api/edge/anime");
      assert.equal(url.searchParams.get("page[offset]"), "40");
      assert.equal(url.searchParams.get("filter[text]"), "another");
      assert.equal(url.searchParams.get("filter[subtype]"), "movie");
      assert.equal(
        request().options.headers.Accept,
        "application/vnd.api+json",
      );
      assert.equal(result.items[0].key, "kitsu:42");
      assert.equal(result.items[0].score, 8.9);
      assert.equal(result.hasMore, true);
    },
  );
});

test("API base URL rejects credentials, mixed content, and query strings", () => {
  assert.equal(
    validBaseUrl("https://example.com/api/"),
    "https://example.com/api",
  );
  assert.equal(validBaseUrl("http://localhost:3000/"), "http://localhost:3000");
  assert.equal(validBaseUrl("http://example.com"), "");
  assert.equal(validBaseUrl("https://user:pass@example.com"), "");
  assert.equal(validBaseUrl("https://example.com/?key=secret"), "");
});
