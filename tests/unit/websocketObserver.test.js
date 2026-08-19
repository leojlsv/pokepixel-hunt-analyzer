import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decodeMessageData,
  parseProtocolPayload
} from "../../userscript/websocket-observer.js";

test("decodes supported WebSocket message payload types", async () => {
  const json = '{"type":"combat.started","seq":1}';
  const bytes = new TextEncoder().encode(json);

  assert.equal(await decodeMessageData(json), json);
  assert.equal(await decodeMessageData(new Blob([json])), json);
  assert.equal(await decodeMessageData(bytes.buffer), json);
  assert.equal(await decodeMessageData(bytes), json);
});

test("unsupported WebSocket message payload returns null", async () => {
  assert.equal(await decodeMessageData({}), null);
  assert.equal(await decodeMessageData(null), null);
});

test("parses JSON objects and ignores invalid frames", async () => {
  assert.deepEqual(
    await parseProtocolPayload('{"type":"capture.success","seq":42}'),
    { type: "capture.success", seq: 42 }
  );
  assert.equal(await parseProtocolPayload("not json"), null);
  assert.equal(await parseProtocolPayload("null"), null);
  assert.equal(await parseProtocolPayload("42"), null);
});
