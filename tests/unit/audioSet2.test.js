import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  SET2_SEGMENTS,
  SET2_SPRITE_URI
} from "../../userscript/audio-assets/set2/sprite.js";

const EXPECTED_KEYS = [
  "epic_captured",
  "epic_fled",
  "legendary_captured",
  "legendary_fled",
  "mythic_captured",
  "mythic_fled",
  "shiny_captured",
  "shiny_fled"
];

test("sound set 2 sprite bytes match the approved batch", () => {
  const prefix = "data:audio/ogg;base64,";
  assert.ok(SET2_SPRITE_URI.startsWith(prefix));

  const bytes = Buffer.from(SET2_SPRITE_URI.slice(prefix.length), "base64");
  assert.equal(bytes.length, 55_497);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "75399ce7e0f118c9cf62374dd80c3b73b74c24c25967e4f29ea1d6ceaf8b9e15"
  );
});

test("sound set 2 exposes all eight ordered alert segments", () => {
  assert.deepEqual(Object.keys(SET2_SEGMENTS), EXPECTED_KEYS);

  let previousEnd = 0;
  for (const key of EXPECTED_KEYS) {
    const segment = SET2_SEGMENTS[key];
    assert.ok(segment.offset >= previousEnd);
    assert.ok(segment.duration > 0);
    previousEnd = segment.offset + segment.duration;
  }
});
