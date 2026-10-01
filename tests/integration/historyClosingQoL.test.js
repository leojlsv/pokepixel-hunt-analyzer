import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

import { createUiMarkup } from "../../userscript/ui-markup.js";
import { createHistoryView } from "../../userscript/history-view.js";
import { createCurrentLootView } from "../../userscript/current-loot-view.js";

function session(sessionId, startedAtMs = Date.now()) {
  return { sessionId, startedAtMs, status: "ended", activityKind: "hunt", accumulatedActiveMs: 1000 };
}

const encounter = {
  encounterId: "encounter-1", speciesId: "pikachu", speciesName: "Pikachu",
  level: 12, quality: "rare", captureResult: "success",
  lootAtMs: Date.now(), captureAtMs: Date.now(), gold: 5,
  lootItems: [{ itemId: "map_fragment", qty: 2 }]
};

function fixture({ loadSessions, loadSessionEncounters = async () => [encounter], now = Date.now }) {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  const beforeDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value: window.document, configurable: true });
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = createUiMarkup();
  document.documentElement.appendChild(host);
  const view = createHistoryView(shadow, { loadSessions, loadSessionEncounters, now });
  return {
    window, shadow, view,
    dispose() {
      host.remove();
      if (beforeDocument) Object.defineProperty(globalThis, "document", beforeDocument);
      else delete globalThis.document;
      window.happyDOM.abort();
    }
  };
}

function choosePeriod({ window, shadow }, period) {
  const select = shadow.getElementById("history-period");
  select.value = period;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function nextTask() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("a changed History period supersedes its in-flight older query", async () => {
  const waiting = [];
  const f = fixture({
    loadSessions: (options) => new Promise((resolve) => waiting.push({ options, resolve }))
  });
  try {
    const first = f.view.refresh();
    assert.equal(waiting.length, 1);
    choosePeriod(f, "today");
    waiting[0].resolve([session("obsolete")]);
    await nextTask();
    assert.equal(waiting.length, 2, "the latest period is queried after the first read");
    assert.ok(waiting[1].options.after > waiting[0].options.after);
    assert.equal(f.shadow.querySelectorAll(".history-hunt-row").length, 0,
      "the superseded response is never rendered");
    waiting[1].resolve([session("latest")]);
    await first;
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId), ["latest"]);
    assert.equal(f.shadow.getElementById("history-load-error").hidden, true);
  } finally {
    f.dispose();
  }
});

test("a new period while Load More is in flight rejects the old appended page", async () => {
  let reads = 0;
  let resolveOldPage;
  const firstRows = Array.from({ length: 21 }, (_, i) => session(`old-${i}`, Date.now() - i));
  const f = fixture({
    loadSessions: (options) => {
      reads += 1;
      if (reads === 1) return Promise.resolve(firstRows);
      if (reads === 2) return new Promise((resolve) => { resolveOldPage = resolve; });
      assert.equal(options.beforeSessionId, undefined, "new period restarts at the first page");
      return Promise.resolve([session("fresh")]);
    }
  });
  try {
    await f.view.refresh();
    assert.equal(f.shadow.querySelectorAll(".history-hunt-row").length, 20);
    const more = f.view.loadMore();
    assert.equal(reads, 2);
    choosePeriod(f, "today");
    resolveOldPage([session("obsolete-more")]);
    await more;
    assert.equal(reads, 3);
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId), ["fresh"]);
    assert.equal(f.shadow.getElementById("history-load-more").hidden, true);
  } finally {
    f.dispose();
  }
});

test("Current invalidation during Load More discards stale appended rows and refreshes", async () => {
  let reads = 0;
  let resolveOldPage;
  const firstRows = Array.from({ length: 21 }, (_, i) => session(`old-${i}`, Date.now() - i));
  const f = fixture({
    loadSessions: () => {
      reads += 1;
      if (reads === 1) return Promise.resolve(firstRows);
      if (reads === 2) return new Promise((resolve) => { resolveOldPage = resolve; });
      return Promise.resolve([session("updated")]);
    }
  });
  try {
    await f.view.refresh();
    const more = f.view.loadMore();
    f.view.invalidate();
    resolveOldPage([session("stale-more")]);
    await more;
    assert.equal(reads, 3);
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId), ["updated"]);
    await f.view.ensureLoaded();
    assert.equal(reads, 3, "the replacement read is now the clean cached History snapshot");
  } finally {
    f.dispose();
  }
});

test("a failed old Load More after Current invalidation still queues the fresh page", async () => {
  let reads = 0;
  let rejectOldPage;
  const firstRows = Array.from({ length: 21 }, (_, i) => session(`old-${i}`, Date.now() - i));
  const f = fixture({
    loadSessions: () => {
      reads += 1;
      if (reads === 1) return Promise.resolve(firstRows);
      if (reads === 2) return new Promise((resolve, reject) => { rejectOldPage = reject; });
      return Promise.resolve([session("updated-after-error")]);
    }
  });
  try {
    await f.view.refresh();
    const more = f.view.loadMore();
    f.view.invalidate();
    rejectOldPage(new Error("outdated paging read failed"));
    await more;
    assert.equal(reads, 3);
    assert.equal(f.shadow.getElementById("history-load-error").hidden, true);
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId),
      ["updated-after-error"]);
  } finally {
    f.dispose();
  }
});

test("a changed Current revision during initial History read cannot mark stale data clean", async () => {
  const waiting = [];
  const f = fixture({
    loadSessions: () => new Promise((resolve) => waiting.push(resolve))
  });
  try {
    const first = f.view.refresh();
    f.view.invalidate();
    const latest = f.view.ensureLoaded();
    waiting[0]([session("obsolete")]);
    await nextTask();
    assert.equal(waiting.length, 2, "the dirty cache queues another first-page read");
    assert.equal(f.shadow.querySelectorAll(".history-hunt-row").length, 0);
    waiting[1]([session("updated")]);
    await Promise.all([first, latest]);
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId), ["updated"]);
  } finally {
    f.dispose();
  }
});

test("History relative periods refresh across local midnight, while All retains the cache", async () => {
  let currentTime = new Date(2026, 9, 1, 12, 0, 0).getTime();
  const reads = [];
  const f = fixture({
    now: () => currentTime,
    loadSessions: async (options) => {
      reads.push(options);
      return [session(`read-${reads.length}`)];
    }
  });
  try {
    choosePeriod(f, "today");
    await nextTask();
    assert.equal(reads.length, 1);
    await f.view.ensureLoaded();
    assert.equal(reads.length, 1, "same local day reuses already loaded Today");

    currentTime += 86_400_000;
    await f.view.ensureLoaded();
    assert.equal(reads.length, 2);
    assert.ok(reads[1].after > reads[0].after, "Today advances its local-day range");
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId),
      ["read-2"]);

    choosePeriod(f, "all");
    await nextTask();
    assert.equal(reads.length, 3);
    currentTime += 86_400_000;
    await f.view.ensureLoaded();
    assert.equal(reads.length, 3, "All has no rolling date boundary to invalidate");
  } finally {
    f.dispose();
  }
});

test("History keeps loaded pages across repeat navigation, and explicit refresh replaces them", async () => {
  let reads = 0;
  const firstRows = Array.from({ length: 21 }, (_, i) => session(`old-${i}`, Date.now() - i));
  const f = fixture({
    loadSessions: (options) => {
      reads += 1;
      if (reads === 1) return Promise.resolve(firstRows);
      if (reads === 2) {
        assert.ok(options.beforeSessionId);
        return Promise.resolve([firstRows[20]]);
      }
      return Promise.resolve([session("reloaded")]);
    }
  });
  try {
    await f.view.ensureLoaded();
    await f.view.loadMore();
    assert.equal(reads, 2);
    assert.equal(f.shadow.querySelectorAll(".history-hunt-row").length, 21);
    await f.view.ensureLoaded();
    await f.view.ensureLoaded();
    assert.equal(reads, 2, "normal History re-entry preserves the expanded page set");
    f.view.invalidate();
    await f.view.ensureLoaded();
    assert.equal(reads, 3, "an authoritative encounter/session change invalidates the cache");
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId), ["reloaded"]);
    f.shadow.getElementById("history-refresh").click();
    await nextTask();
    assert.equal(reads, 4, "explicit Refresh always rereads the repository");
  } finally {
    f.dispose();
  }
});

test("History read errors preserve loaded rows and permit Retry for both paging and reload", async () => {
  let reads = 0;
  const originalError = console.error;
  console.error = () => {};
  const f = fixture({
    loadSessions: () => {
      reads += 1;
      if (reads === 1) {
        return Promise.resolve(Array.from({ length: 21 }, (_, i) => session(`old-${i}`, Date.now() - i)));
      }
      if (reads === 2 || reads === 4) throw new Error("synthetic failed IndexedDB read");
      if (reads === 3) return Promise.resolve([session("last")]);
      return Promise.resolve([session("new")]);
    }
  });
  try {
    await f.view.refresh();
    assert.equal(f.shadow.querySelectorAll(".history-hunt-row").length, 20);
    await f.view.loadMore();
    assert.equal(f.shadow.querySelectorAll(".history-hunt-row").length, 20);
    assert.equal(f.shadow.getElementById("history-load-error").hidden, false);
    assert.match(f.shadow.getElementById("history-load-error-message").textContent, /more sessions/);
    assert.equal(f.shadow.getElementById("history-load-more").disabled, false);
    f.shadow.getElementById("history-retry").click();
    await nextTask();
    assert.equal(f.shadow.querySelectorAll(".history-hunt-row").length, 21);
    assert.equal(f.shadow.getElementById("history-load-error").hidden, true);

    await f.view.refresh();
    assert.equal(f.shadow.querySelectorAll(".history-hunt-row").length, 21,
      "failed reload must not erase previously loaded pages");
    assert.match(f.shadow.getElementById("history-load-error-message").textContent, /refresh History/);
    f.shadow.getElementById("history-retry").click();
    await nextTask();
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId), ["new"]);
    assert.equal(f.shadow.getElementById("history-load-error").hidden, true);
  } finally {
    console.error = originalError;
    f.dispose();
  }
});

test("failed period switch cannot Load More from an older period", async () => {
  let reads = 0;
  const previousConsoleError = console.error;
  console.error = () => {};
  const f = fixture({
    loadSessions: () => {
      reads += 1;
      if (reads === 1) {
        return Promise.resolve(Array.from({ length: 21 }, (_, i) => session(`last-week-${i}`, Date.now() - i)));
      }
      if (reads === 2) throw new Error("new period unavailable");
      return Promise.resolve([session("today-recovered")]);
    }
  });
  try {
    await f.view.refresh();
    assert.equal(f.shadow.getElementById("history-load-more").hidden, false);
    choosePeriod(f, "today");
    await nextTask();
    assert.equal(f.shadow.getElementById("history-load-error").hidden, false);
    assert.equal(f.shadow.getElementById("history-load-more").hidden, true,
      "a failed Today read must not expose the old 7 Days continuation");
    await f.view.loadMore();
    assert.equal(reads, 2, "programmatic Load More also rejects the mismatched period");
    f.shadow.getElementById("history-retry").click();
    await nextTask();
    assert.equal(reads, 3);
    assert.deepEqual([...f.shadow.querySelectorAll(".history-hunt-row")].map((row) => row.dataset.sessionId),
      ["today-recovered"]);
    assert.equal(f.shadow.getElementById("history-load-error").hidden, true);
  } finally {
    console.error = previousConsoleError;
    f.dispose();
  }
});

test("keyboard focus has a stable destination when Retry or exhausted Load More disappears", async () => {
  const originalError = console.error;
  console.error = () => {};
  let reads = 0;
  const firstPage = Array.from({ length: 21 }, (_, i) => session(`old-${i}`, Date.now() - i));
  const f = fixture({
    loadSessions: async () => {
      reads += 1;
      if (reads === 1 || reads === 4) return firstPage;
      if (reads === 2) throw new Error("temporary read failure");
      return [firstPage[20]];
    }
  });
  try {
    await f.view.refresh();
    const more = f.shadow.getElementById("history-load-more");
    more.focus();
    await f.view.loadMore();
    assert.ok(f.shadow.activeElement === more, "a failed page retains its available Load More focus");
    const retry = f.shadow.getElementById("history-retry");
    retry.focus();
    retry.click();
    await nextTask();
    assert.equal(f.shadow.getElementById("history-load-error").hidden, true);
    assert.equal(more.hidden, true);
    assert.ok(f.shadow.activeElement === f.shadow.getElementById("history-count"),
      "hiding the active Retry control restores focus to the persistent status");

    await f.view.refresh();
    const again = f.shadow.getElementById("history-load-more");
    assert.equal(again.hidden, false);
    again.focus();
    await f.view.loadMore();
    assert.equal(again.hidden, true);
    assert.ok(f.shadow.activeElement === f.shadow.getElementById("history-count"),
      "finishing the final page does not drop keyboard focus");
  } finally {
    console.error = originalError;
    f.dispose();
  }
});

test("an external Current invalidation cannot strand focus on a hidden Load More", async () => {
  const pages = Array.from({ length: 21 }, (_, i) => session(`saved-${i}`, Date.now() - i));
  const f = fixture({ loadSessions: async () => pages });
  try {
    await f.view.refresh();
    const more = f.shadow.getElementById("history-load-more");
    assert.equal(more.hidden, false);
    more.focus();
    f.view.invalidate();
    assert.equal(more.hidden, true);
    assert.equal(f.shadow.getElementById("history-refresh").textContent, "Refresh •");
    assert.ok(f.shadow.activeElement === f.shadow.getElementById("history-count"),
      "dirty History moves focus to a surviving toolbar control");
  } finally {
    f.dispose();
  }
});

test("expand/collapse via keyboard restores focus on all History rows and Current Loot", async () => {
  const f = fixture({ loadSessions: async () => [session("hunt-a")] });
  try {
    await f.view.refresh();
    for (const [subtab, selector] of [
      ["hunts", ".history-hunt-row"],
      ["pokemon", ".history-pokemon-row"],
      ["attempts", ".history-attempt-row"],
      ["loot", ".history-loot-row"]
    ]) {
      f.shadow.querySelector(`[data-history-view="${subtab}"]`).click();
      for (const key of ["Enter", " "]) {
        const originalRow = f.shadow.querySelector(selector);
        assert.ok(originalRow, `${subtab} has an expandable row`);
        originalRow.focus();
        originalRow.dispatchEvent(new f.window.KeyboardEvent("keydown", { key, bubbles: true }));
        const replacement = f.shadow.querySelector(selector);
        assert.notEqual(replacement, originalRow, "a full table repaint occurred");
        assert.equal(f.shadow.activeElement, replacement, `${subtab} keeps its keyboard focus`);
        assert.equal(replacement.getAttribute("aria-expanded"), key === "Enter" ? "true" : "false");
      }
    }

    const current = createCurrentLootView(f.shadow);
    current.render({ sessionId: "hunt-a", lootDataRevision: 1, encounters: [encounter] });
    for (const key of ["Enter", " "]) {
      const row = f.shadow.querySelector(".current-loot-row");
      row.focus();
      row.dispatchEvent(new f.window.KeyboardEvent("keydown", { key, bubbles: true }));
      const replacement = f.shadow.querySelector(".current-loot-row");
      assert.equal(f.shadow.activeElement, replacement);
      assert.equal(replacement.getAttribute("aria-expanded"), key === "Enter" ? "true" : "false");
    }
  } finally {
    f.dispose();
  }
});
