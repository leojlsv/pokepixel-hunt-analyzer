import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canDeleteHunt,
  deleteHuntData
} from "../../services/huntDeletion.js";

test("Hunt deletion policy allows non-current sessions", () => {
  assert.equal(canDeleteHunt({
    sessionId: "session-1",
    currentSession: { sessionId: "session-2", status: "running" }
  }), true);
});

test("Hunt deletion policy blocks the current Hunt until it is ended", () => {
  assert.equal(canDeleteHunt({
    sessionId: "session-1",
    currentSession: { sessionId: "session-1", status: "running" }
  }), false);
  assert.equal(canDeleteHunt({
    sessionId: "session-1",
    currentSession: { sessionId: "session-1", status: "paused" }
  }), false);
  assert.equal(canDeleteHunt({
    sessionId: "session-1",
    currentSession: { sessionId: "session-1", status: "ended" }
  }), true);
});

test("Hunt deletion removes encounters before the session row", async () => {
  const calls = [];
  const result = await deleteHuntData({
    sessionId: "session-1",
    encountersRepository: {
      async deleteBySessionId(sessionId) {
        calls.push(["encounters", sessionId]);
      }
    },
    sessionsRepository: {
      async getCurrentReadOnly() {
        return { sessionId: "session-2", status: "running" };
      },
      async deleteSession(sessionId) {
        calls.push(["session", sessionId]);
      }
    }
  });

  assert.deepEqual(calls, [
    ["encounters", "session-1"],
    ["session", "session-1"]
  ]);
  assert.deepEqual(result, { deletingCurrent: false });
});

test("ended current Hunt may be deleted and is reported to the caller", async () => {
  const calls = [];
  const result = await deleteHuntData({
    sessionId: "session-1",
    encountersRepository: {
      async deleteBySessionId(sessionId) {
        calls.push(["encounters", sessionId]);
      }
    },
    sessionsRepository: {
      async getCurrentReadOnly() {
        return { sessionId: "session-1", status: "ended" };
      },
      async deleteSession(sessionId) {
        calls.push(["session", sessionId]);
      }
    }
  });

  assert.deepEqual(result, { deletingCurrent: true });
  assert.deepEqual(calls, [
    ["encounters", "session-1"],
    ["session", "session-1"]
  ]);
});

test("running current Hunt is rejected before any deletion", async () => {
  let encounterDeleteCalled = false;
  let sessionDeleteCalled = false;

  await assert.rejects(() => deleteHuntData({
    sessionId: "session-1",
    encountersRepository: {
      async deleteBySessionId() {
        encounterDeleteCalled = true;
      }
    },
    sessionsRepository: {
      async getCurrentReadOnly() {
        return { sessionId: "session-1", status: "running" };
      },
      async deleteSession() {
        sessionDeleteCalled = true;
      }
    }
  }), /End the current Hunt before deleting it/);

  assert.equal(encounterDeleteCalled, false);
  assert.equal(sessionDeleteCalled, false);
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
      async getCurrentReadOnly() {
        return { sessionId: "session-2", status: "running" };
      },
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
      encountersRepository: { deleteBySessionId() {} },
      sessionsRepository: { deleteSession() {} }
    }),
    /getCurrentReadOnly is required/
  );

  await assert.rejects(
    () => deleteHuntData({
      sessionId: "session-1",
      encountersRepository: {},
      sessionsRepository: {
        getCurrentReadOnly() {},
        deleteSession() {}
      }
    }),
    /deleteBySessionId is required/
  );
});
