import { test } from "node:test";
import assert from "node:assert/strict";

import { decideSessionTransition } from "../../domain/huntLifecycle.js";

test("first-ever combat.started (no serverSessionId adopted yet) -> adopt", () => {
  const result = decideSessionTransition(
    { serverSessionId: null, zoneId: null },
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" }
  );

  assert.deepEqual(result, { action: "adopt" });
});

test("same serverSessionId and zoneId -> none", () => {
  const result = decideSessionTransition(
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" },
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" }
  );

  assert.deepEqual(result, { action: "none" });
});

test("confirmed new serverSessionId -> new_hunt, regardless of zoneId", () => {
  const result = decideSessionTransition(
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" },
    { serverSessionId: "server_session_0002", zoneId: "zone_0001" }
  );

  assert.deepEqual(result, { action: "new_hunt" });
});

test("confirmed zoneId change with same serverSessionId -> new_hunt", () => {
  const result = decideSessionTransition(
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" },
    { serverSessionId: "server_session_0001", zoneId: "zone_0002" }
  );

  assert.deepEqual(result, { action: "new_hunt" });
});

test("no observed serverSessionId -> none (nothing to decide)", () => {
  const result = decideSessionTransition(
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" },
    { serverSessionId: null, zoneId: "zone_0002" }
  );

  assert.deepEqual(result, { action: "none" });
});

test("missing current zoneId does not falsely start a new hunt", () => {
  const result = decideSessionTransition(
    { serverSessionId: "server_session_0001", zoneId: null },
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" }
  );

  assert.deepEqual(result, { action: "none" });
});
