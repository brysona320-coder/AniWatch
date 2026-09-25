import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeManga,
  normalizeChapter,
  fetchChapterPages,
} from "../src/manga.js";
import worker from "../worker/manga-proxy.js";

const MANGA_ID = "801513ba-a712-498c-8f57-cae55b38cc92";
const CHAPTER_ID = "6310f6a1-17ee-4890-b837-2ec1b372905b";

test("MangaDex records keep English title and cover URL", () => {
  const item = normalizeManga({
    id: MANGA_ID,
    attributes: {
      title: { "ja-ro": "Berserk" },
      altTitles: [{ en: "Berserk" }],
      description: { en: "Read it" },
    },
    relationships: [
      { type: "cover_art", attributes: { fileName: "cover.jpg" } },
    ],
  });
  assert.equal(item.title, "Berserk");
  assert.equal(
    item.cover,
    `https://uploads.mangadex.org/covers/${MANGA_ID}/cover.jpg.256.jpg`,
  );
});

test("publisher chapters are distinguished from in-site pages", () => {
  const chapter = normalizeChapter({
    id: CHAPTER_ID,
    attributes: {
      chapter: "1",
      pages: 0,
      externalUrl: "https://mangaplus.shueisha.co.jp/viewer/1",
    },
  });
  assert.equal(chapter.pages, 0);
  assert.equal(
    chapter.externalUrl,
    "https://mangaplus.shueisha.co.jp/viewer/1",
  );
});

test("reader builds image URLs from at-home data", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        baseUrl: "https://node.mangadex.network",
        chapter: { hash: "abc123", dataSaver: ["page-1.jpg", "page-2.jpg"] },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  try {
    assert.deepEqual(await fetchChapterPages(CHAPTER_ID), [
      "https://node.mangadex.network/data-saver/abc123/page-1.jpg",
      "https://node.mangadex.network/data-saver/abc123/page-2.jpg",
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test("worker only proxies manga routes from the Pages origin", async () => {
  const original = globalThis.fetch;
  let upstream = "";
  globalThis.fetch = async (url) => {
    upstream = url;
    return new Response('{"result":"ok"}', {
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const allowed = await worker.fetch(
      new Request(
        `https://example.workers.dev/manga/${MANGA_ID}/feed?limit=1`,
        { headers: { Origin: "https://brysona320-coder.github.io" } },
      ),
    );
    assert.equal(allowed.status, 200);
    assert.equal(
      allowed.headers.get("Access-Control-Allow-Origin"),
      "https://brysona320-coder.github.io",
    );
    assert.equal(
      upstream,
      `https://api.mangadex.org/manga/${MANGA_ID}/feed?limit=1`,
    );
    assert.equal(
      (
        await worker.fetch(
          new Request("https://example.workers.dev/private", {
            headers: { Origin: "https://brysona320-coder.github.io" },
          }),
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await worker.fetch(
          new Request("https://example.workers.dev/manga", {
            headers: { Origin: "https://other.example" },
          }),
        )
      ).status,
      403,
    );
  } finally {
    globalThis.fetch = original;
  }
});
