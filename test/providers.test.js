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
      await assert.rejects(fetchAnime({}), /Too many requests/);
    },
  );
  await withFetch({ data: [] }, async () => {
    await assert.rejects(fetchAnime({}), /unexpected catalog response/);
  });
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
