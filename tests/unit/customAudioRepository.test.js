import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import {
  createCustomAudioRepository,
  CUSTOM_AUDIO_MAX_BYTES,
  CUSTOM_AUDIO_MAX_DURATION_SECONDS
} from "../../userscript/custom-audio-repository.js";

function bytes(...values) {
  return new Uint8Array(values).buffer;
}

test("custom audio repository stores one record per rarity-status key", async () => {
  const repository = createCustomAudioRepository(new IDBFactory());
  await repository.put({
    key: "legendary_fled",
    fileName: "first.mp3",
    mimeType: "audio/mpeg",
    size: 3,
    duration: 1.2,
    data: bytes(1, 2, 3),
    createdAt: 1
  });

  const saved = await repository.get("legendary_fled");
  assert.equal(saved.fileName, "first.mp3");
  assert.deepEqual([...new Uint8Array(saved.data)], [1, 2, 3]);
  assert.equal(await repository.has("legendary_fled"), true);
});

test("importing again into the same slot replaces the previous custom audio", async () => {
  const repository = createCustomAudioRepository(new IDBFactory());
  await repository.put({
    key: "epic_captured",
    fileName: "old.wav",
    mimeType: "audio/wav",
    size: 2,
    duration: 0.5,
    data: bytes(1, 1),
    createdAt: 1
  });
  await repository.put({
    key: "epic_captured",
    fileName: "new.ogg",
    mimeType: "audio/ogg",
    size: 3,
    duration: 0.8,
    data: bytes(9, 8, 7),
    createdAt: 2
  });

  const records = await repository.list();
  assert.equal(records.length, 1);
  assert.equal(records[0].fileName, "new.ogg");
  assert.deepEqual([...new Uint8Array(records[0].data)], [9, 8, 7]);
});

test("replacing one slot does not affect another rarity-status slot", async () => {
  const repository = createCustomAudioRepository(new IDBFactory());
  await repository.put({ key: "shiny_fled", fileName: "shiny.mp3", mimeType: "audio/mpeg", size: 1, duration: 1, data: bytes(1), createdAt: 1 });
  await repository.put({ key: "mythic_fled", fileName: "mythic.mp3", mimeType: "audio/mpeg", size: 1, duration: 1, data: bytes(2), createdAt: 1 });
  await repository.put({ key: "shiny_fled", fileName: "shiny-new.mp3", mimeType: "audio/mpeg", size: 1, duration: 1, data: bytes(3), createdAt: 2 });

  assert.equal((await repository.get("shiny_fled")).fileName, "shiny-new.mp3");
  assert.equal((await repository.get("mythic_fled")).fileName, "mythic.mp3");
});

test("remove deletes only the requested custom slot", async () => {
  const repository = createCustomAudioRepository(new IDBFactory());
  await repository.put({ key: "legendary_captured", fileName: "a.mp3", mimeType: "audio/mpeg", size: 1, duration: 1, data: bytes(1), createdAt: 1 });
  await repository.put({ key: "legendary_fled", fileName: "b.mp3", mimeType: "audio/mpeg", size: 1, duration: 1, data: bytes(2), createdAt: 1 });

  await repository.remove("legendary_fled");
  assert.equal(await repository.has("legendary_fled"), false);
  assert.equal(await repository.has("legendary_captured"), true);
});

test("custom audio limits remain explicit and bounded", () => {
  assert.equal(CUSTOM_AUDIO_MAX_BYTES, 2 * 1024 * 1024);
  assert.equal(CUSTOM_AUDIO_MAX_DURATION_SECONDS, 10);
});
