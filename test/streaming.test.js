import test from "node:test";
import assert from "node:assert/strict";
import {
  searchStreams,
  getStreamInfo,
  getEpisodeSources,
} from "../src/streaming.js";

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

test("Consumet search returns title candidates instead of choosing one", async () => {
  await withFetch(
    {
      results: [
        {
          id: "naruto-1",
          title: "Naruto",
          image: "http://invalid.test/poster.jpg",
        },
        { id: "naruto-2", title: "Naruto Shippuden" },
      ],
    },
    async (request) => {
      const matches = await searchStreams({
        baseUrl: "https://streams.example",
        provider: "animekai",
        query: "Naruto & Friends",
      });
      assert.equal(
        request().url,
        "https://streams.example/anime/animekai/Naruto%20%26%20Friends",
      );
      assert.equal(matches.length, 2);
      assert.equal(matches[0].image, "");
    },
  );
});

test("AnimeParadise title resolves to episodes and a playable HLS URL", async () => {
  await withFetch(
    {
      success: true,
      data: [
        { _id: "movie-1", title: "Sample: The Movie", episodes: 1 },
        { _id: "show-1", title: "Sample", episodes: 12 },
      ],
    },
    async (request) => {
      const matches = await searchStreams({
        provider: "animeparadise",
        query: "Sample",
      });
      assert.equal(new URL(request().url).pathname, "/search");
      assert.equal(matches[0].id, "show-1");
      assert.equal(matches[1].id, "movie-1");
    },
  );
  await withFetch(
    {
      success: true,
      data: [{ uid: "episode-1", number: "1", title: "Pilot" }],
    },
    async (request) => {
      const info = await getStreamInfo({
        provider: "animeparadise",
        id: "show-1",
      });
      assert.equal(new URL(request().url).pathname, "/anime/show-1/episode");
      assert.equal(info.episodes[0].id, "episode-1:show-1");
    },
  );
  await withFetch(
    {
      success: true,
      data: {
        episode: { streamLink: "https://media.example/master.m3u8?key=a&b=c" },
      },
    },
    async (request) => {
      const stream = await getEpisodeSources({
        provider: "animeparadise",
        episodeId: "episode-1:show-1",
      });
      const url = new URL(request().url);
      assert.equal(url.pathname, "/ep/episode-1");
      assert.equal(url.searchParams.get("origin"), "show-1");
      assert.equal(stream.sources[0].hls, true);
      const playbackUrl = new URL(stream.sources[0].url);
      assert.equal(playbackUrl.host, "stream.animeparadise.moe");
      assert.equal(
        playbackUrl.searchParams.get("url"),
        "https://media.example/master.m3u8?key=a&b=c",
      );
    },
  );
});

test("AnimeKai and Animepahe use their documented episode routes", async () => {
  await withFetch(
    { episodes: [{ id: "ep 1", number: 1 }], totalEpisodes: 24 },
    async (request) => {
      const info = await getStreamInfo({
        provider: "animekai",
        id: "series/one",
      });
      assert.match(request().url, /\/anime\/animekai\/info\?id=series%2Fone$/);
      assert.equal(info.episodes[0].id, "ep 1");
    },
  );
  await withFetch(
    { episodes: [{ id: "ep-2", number: 2 }], totalEpisodes: 24 },
    async (request) => {
      await getStreamInfo({
        provider: "animepahe",
        id: "series one",
        episodePage: 2,
      });
      assert.match(
        request().url,
        /\/anime\/animepahe\/info\/series%20one\?episodePage=2$/,
      );
    },
  );
  await withFetch(
    {
      sources: [{ url: "https://video.example/master.m3u8", quality: "1080p" }],
      headers: { Referer: "https://origin.example" },
    },
    async (request) => {
      const result = await getEpisodeSources({
        provider: "animekai",
        episodeId: "ep 1",
      });
      assert.match(request().url, /\/anime\/animekai\/watch\/ep%201$/);
      assert.equal(result.sources[0].hls, true);
      assert.equal(result.needsHeaders, true);
    },
  );
  await withFetch(
    { sources: [{ url: "https://video.example/movie.mp4", quality: "720p" }] },
    async (request) => {
      const result = await getEpisodeSources({
        provider: "animepahe",
        episodeId: "ep/1",
      });
      assert.match(
        request().url,
        /\/anime\/animepahe\/watch\?episodeId=ep%2F1$/,
      );
      assert.equal(result.sources[0].hls, false);
    },
  );
});

test("Consumet rejects malformed responses and non-HTTPS video URLs", async () => {
  await withFetch({ results: null }, async () => {
    await assert.rejects(
      searchStreams({ provider: "animekai", query: "x" }),
      /unexpected search response/,
    );
  });
  await withFetch(
    { sources: [{ url: "http://video.example/file.mp4" }] },
    async () => {
      const result = await getEpisodeSources({
        provider: "animekai",
        episodeId: "x",
      });
      assert.deepEqual(result.sources, []);
    },
  );
});
