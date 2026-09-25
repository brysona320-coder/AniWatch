import test from "node:test";
import assert from "node:assert/strict";
import { STREAMS } from "../src/streams.js";

test("the on-site watch catalog has distinct playable films and source pages", () => {
  assert.ok(STREAMS.length > 0);
  assert.equal(new Set(STREAMS.map((film) => film.id)).size, STREAMS.length);

  for (const film of STREAMS) {
    assert.ok(film.title && Number.isInteger(film.year));
    assert.match(film.videoUrl, /^https:\/\/.+\.(webm|mp4)$/);
    assert.match(film.poster, /^https:\/\/.+\.(jpg|jpeg|png|webp)$/);
    assert.match(film.sourceUrl, /^https:\/\/.+/);
    assert.notEqual(film.videoUrl, film.poster);
  }
});
