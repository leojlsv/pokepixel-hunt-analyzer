import { test } from "node:test";
import assert from "node:assert/strict";

import { deleteHuntData } from "../../services/huntDeletion.js";

test("Hunt deletion removes encounters before the session row", async () => {
  const calls = [];
  await deleteHuntData({
    sessionId: "session-1",
    encountersRepository: {
      async deleteBySessionId(sessionId) {
        calls.push(["encounters", sessionId]);
      }
    },
    sessionsRepository: {
      async deleteSession(sessionId) {
        calls.push(["session", sessionId]);
      }
    }
  });

  assert.deepEqual(calls, [
    ["encounters", "session-1"],
    ["session", "session-1"]
  ]);
});

test("Hunt deletion never deletes the session when encounter cleanup fails", async () => {
  let sessionDeleteCalled = false;

  await assert.rejects(() => deleteHuntData({
    sessionId: "session-1",
    encountersRepository: {
      async deleteBySessionId() {
        throw new Error("simulated encounter delete failure");
      }
    },
    sessionsRepository: {
      async deleteSession() {
        sessionDeleteCalled = true;
      }
    }
  }), /simulated encounter delete failure/);

  assert.equal(sessionDeleteCalled, false);
});

test("Hunt deletion rejects invalid dependencies before mutating data", async () => {
  await assert.rejects(
    () => deleteHuntData({
      sessionId: "",
      encountersRepository: {},
      sessionsRepository: {}
    }),
    /sessionId is required/
  );

  await assert.rejects(
    () => deleteHuntData({
      sessionId: "session-1",
      encountersRepository: {},
      sessionsRepository: { deleteSession() {} }
    }),
    /deleteBySessionId is required/
  );
});
