import { computeGroupMetrics } from "../domain/groupMetrics.js";
import { computeRarityBreakdown } from "../domain/rarityBreakdown.js";
import { computeSessionMetrics } from "../domain/sessionMetrics.js";
import { aggregateLootHistory } from "./loot-history-model.js";
import { bindLootRarityFilter } from "./loot-rarity-filter.js";
import {
  knownLootItemRarity,
  lootItemCatalogSignature
} from "./loot-item-catalog.js";
import {
  NOTABLE_RARITIES,
  notableEncounters
} from "./hunt-view-model.js";
import {
  RARITIES,
  formatCompact,
  formatNumber,
  formatRate,
  populateSelect,
  rarityClass,
  speciesLabel
} from "./ui-utils.js";

const HISTORY_PAGE_SIZE = 20;
const HISTORY_LOAD_CONCURRENCY = 4;
const HISTORY_SUBVIEWS = new Set(["hunts", "pokemon", "attempts", "loot"]);
const ATTEMPT_BATCH_SIZE = 100;

function sameHistoryRange(left, right) {
  return left?.after === right?.after && left?.before === right?.before;
}

const RARITY_SHORT = new Map([
  ["weak", "Wk"],
  ["common", "Com"],
  ["uncommon", "Unc"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Leg"],
  ["mythical", "Myt"]
]);

function lootItemRarity(metadata) {
  const key = knownLootItemRarity(metadata?.rarity);
  return RARITIES.some(([rarity]) => rarity === key) ? key : "none";
}

function addColumnGroup(table, classNames) {
  const group = document.createElement("colgroup");
  for (const className of classNames) {
    const column = document.createElement("col");
    column.className = className;
    group.appendChild(column);
  }
  table.appendChild(group);
}

function startOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function periodRange(period, now = Date.now()) {
  const today = startOfLocalDay(now);
  const oneDay = 86_400_000;

  switch (period) {
    case "today":
      return { after: today, before: today + oneDay };
    case "yesterday":
      return { after: today - oneDay, before: today };
    case "30d":
      return { after: today - 29 * oneDay, before: today + oneDay };
    case "all":
      return {};
    case "7d":
    default:
      return { after: today - 6 * oneDay, before: today + oneDay };
  }
}

function formatHistoryDate(timestamp) {
  if (!Number.isFinite(timestamp)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

function formatHistoryDuration(milliseconds) {
  const safeMs = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const totalMinutes = Math.floor(safeMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatClock(timestamp) {
  if (!Number.isFinite(timestamp)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

function formatAttemptTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

function ivTotal(encounter) {
  if (Number.isFinite(encounter.ivTotal)) return encounter.ivTotal;
  if (!encounter.ivs || typeof encounter.ivs !== "object") return null;
  const values = [
    encounter.ivs.hp,
    encounter.ivs.atk,
    encounter.ivs.def,
    encounter.ivs.spa,
    encounter.ivs.spd,
    encounter.ivs.spe
  ];
  return values.some(Number.isFinite)
    ? values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
    : null;
}

function distinctElements(encounters) {
  return [...new Set(encounters.flatMap((encounter) =>
    Array.isArray(encounter.elements) ? encounter.elements : []
  ))].sort();
}

export async function mapWithConcurrency(items, mapper, concurrency = 4) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive safe integer");
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

export async function loadHistoryPage({
  loadSessions,
  loadSessionEncounters,
  range = {},
  before = range.before ?? Infinity,
  pageSize = HISTORY_PAGE_SIZE,
  concurrency = HISTORY_LOAD_CONCURRENCY,
  now = Date.now
}) {
  const cursor = before && typeof before === "object" ? before : null;
  const rows = await loadSessions({
    ...range,
    before: cursor ? cursor.startedAtMs : before,
    ...(cursor ? { beforeSessionId: cursor.sessionId } : {}),
    limit: pageSize + 1
  });
  const sessions = rows.slice(0, pageSize);
  const bundles = await mapWithConcurrency(
    sessions,
    async (session) => {
      const encounters = await loadSessionEncounters(session.sessionId);
      return {
        session,
        encounters,
        metrics: computeSessionMetrics({ session, encounters, now: now() })
      };
    },
    concurrency
  );

  return {
    bundles,
    nextBefore: rows.length > pageSize && sessions.length > 0
      ? {
          startedAtMs: sessions[sessions.length - 1].startedAtMs,
          sessionId: sessions[sessions.length - 1].sessionId
        }
      : null
  };
}

export function createHistoryView(shadow, {
  loadSessions,
  loadSessionEncounters,
  getLootItemCatalog = () => null,
  now = Date.now
}) {
  let bundles = [];
  let activeSubview = "hunts";
  let attemptRenderCount = ATTEMPT_BATCH_SIZE;
  let loading = false;
  let loadPromise = null;
  let pendingRefresh = false;
  let inFlightPeriod = null;
  let inFlightRange = null;
  let inFlightOperation = null;
  let inFlightDataVersion = null;
  let dataVersion = 0;
  let loadedPeriod = null;
  let failedLoad = null;
  let nextBefore = null;
  const expandedHunts = new Set();
  const expandedAttempts = new Set();
  const expandedPokemon = new Set();
  const expandedLoot = new Set();
  let selectedLootSessionId = "*";
  const lootRarityFilter = bindLootRarityFilter(shadow, {
    prefix: "history-loot",
    scope: "history",
    onChange: () => renderLoot({ preserveScroll: true, reuseSummary: true })
  });
  let cachedLootSummary = null;
  let currentLootCatalogSignature = "";
  const notableSelectionBySession = new Map();
  const filters = {
    period: "7d",
    species: "*",
    rarity: "*",
    result: "*",
    capsule: "*",
    element: "*",
    shiny: "*"
  };
  let activeRange = periodRange(filters.period, now());

  function currentRange() {
    return periodRange(filters.period, now());
  }

  function historyIsFresh() {
    return loadedPeriod === filters.period && sameHistoryRange(activeRange, currentRange());
  }

  bindControls();

  function setActiveSubview(value, { focus = false } = {}) {
    const next = String(value || "").trim().toLowerCase();
    if (!HISTORY_SUBVIEWS.has(next)) return false;
    activeSubview = next;
    attemptRenderCount = ATTEMPT_BATCH_SIZE;
    let activeButton = null;
    for (const candidate of shadow.querySelectorAll("[data-history-view]")) {
      const selected = candidate.dataset.historyView === activeSubview;
      candidate.classList.toggle("active", selected);
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      if (selected) activeButton = candidate;
    }
    render();
    if (focus) activeButton?.focus({ preventScroll: true });
    return true;
  }

  function bindControls() {
    for (const button of shadow.querySelectorAll("[data-history-view]")) {
      button.addEventListener("click", () => {
        setActiveSubview(button.dataset.historyView);
      });
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const buttons = [...shadow.querySelectorAll("[data-history-view]")];
        const current = Math.max(0, buttons.indexOf(event.currentTarget));
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        event.preventDefault();
        setActiveSubview(buttons[nextIndex].dataset.historyView, { focus: true });
      });
    }

    shadow.getElementById("history-period").addEventListener("change", (event) => {
      filters.period = event.target.value;
      void refresh();
    });

    const bindings = [
      ["history-species", "species"],
      ["history-rarity", "rarity"],
      ["history-result", "result"],
      ["history-capsule", "capsule"],
      ["history-element", "element"],
      ["history-shiny", "shiny"]
    ];
    for (const [id, key] of bindings) {
      shadow.getElementById(id).addEventListener("change", (event) => {
        filters[key] = event.target.value;
        attemptRenderCount = ATTEMPT_BATCH_SIZE;
        render();
      });
    }

    shadow.getElementById("history-more-filters").addEventListener("click", (event) => {
      const advanced = shadow.getElementById("history-advanced-filters");
      advanced.hidden = !advanced.hidden;
      event.currentTarget.textContent = advanced.hidden ? "More Filters ▾" : "Less Filters ▴";
      event.currentTarget.setAttribute("aria-expanded", String(!advanced.hidden));
    });

    shadow.getElementById("history-load-more").addEventListener("click", () => {
      void loadMore();
    });
    shadow.getElementById("history-refresh").addEventListener("click", () => {
      void refresh();
    });
    shadow.getElementById("history-retry").addEventListener("click", () => {
      if (failedLoad === "more") void loadMore();
      else void refresh();
    });

    shadow.getElementById("history-loot-session").addEventListener("change", (event) => {
      selectedLootSessionId = event.target.value;
      expandedLoot.clear();
      renderLoot();
    });

    const attemptsWrap = shadow.getElementById("history-attempts-wrap");
    attemptsWrap.addEventListener("scroll", () => {
      if (activeSubview !== "attempts") return;
      const remaining = attemptsWrap.scrollHeight - attemptsWrap.scrollTop - attemptsWrap.clientHeight;
      if (remaining > 48) return;
      const total = filteredAttempts().length;
      if (attemptRenderCount >= total) return;
      attemptRenderCount = Math.min(total, attemptRenderCount + ATTEMPT_BATCH_SIZE);
      renderAttempts();
    }, { passive: true });
  }

  function clearLoadError() {
    const wasRetryFocused = shadow.activeElement === shadow.getElementById("history-retry");
    shadow.getElementById("history-load-error").hidden = true;
    failedLoad = null;
    if (wasRetryFocused) shadow.getElementById("history-count").focus({ preventScroll: true });
  }

  function reportLoadError(operation, error) {
    failedLoad = operation;
    const detail = operation === "more"
      ? "Could not load more sessions. Previously loaded results are preserved."
      : "Could not refresh History. Previously loaded results may belong to another period.";
    shadow.getElementById("history-load-error-message").textContent = detail;
    shadow.getElementById("history-load-error").hidden = false;
    setStatus(operation === "more" && loadedPeriod != null
      ? `Load More failed · ${bundles.length} sessions still loaded`
      : "History refresh failed");
    console.error("PokePixel Hunt Analyzer (History):", error);
  }

  async function performRefresh() {
    pendingRefresh = false;
    const period = filters.period;
    const range = currentRange();
    inFlightPeriod = period;
    inFlightRange = range;
    inFlightOperation = "refresh";
    inFlightDataVersion = dataVersion;
    setStatus("Loading…");
    clearLoadError();

    try {
      const page = await loadHistoryPage({
        loadSessions,
        loadSessionEncounters,
        range
      });
      // A newer period/refresh request supersedes this response, including
      // when the old request completed successfully after the new selection.
      if (pendingRefresh || !sameHistoryRange(range, currentRange())) {
        pendingRefresh = true;
        return;
      }
      bundles = page.bundles;
      nextBefore = page.nextBefore;
      activeRange = range;
      // A Current change during the read must not turn a potentially older
      // History snapshot into a permanently clean cached page.
      loadedPeriod = inFlightDataVersion === dataVersion ? period : null;
      expandedHunts.clear();
      expandedAttempts.clear();
      expandedPokemon.clear();
      expandedLoot.clear();
      notableSelectionBySession.clear();
      attemptRenderCount = ATTEMPT_BATCH_SIZE;
      populateFilters();
      populateLootSessions();
      render();
    } catch (error) {
      if (!pendingRefresh) reportLoadError("refresh", error);
    }
  }

  async function performLoadMore() {
    const before = nextBefore;
    inFlightPeriod = loadedPeriod;
    inFlightRange = activeRange;
    inFlightOperation = "more";
    inFlightDataVersion = dataVersion;
    clearLoadError();
    try {
      const page = await loadHistoryPage({
        loadSessions,
        loadSessionEncounters,
        range: activeRange,
        before
      });
      if (pendingRefresh || inFlightDataVersion !== dataVersion || !sameHistoryRange(activeRange, currentRange())) {
        pendingRefresh = true;
        return;
      }
      bundles.push(...page.bundles);
      nextBefore = page.nextBefore;
      populateFilters();
      populateLootSessions();
      render();
    } catch (error) {
      if (inFlightDataVersion !== dataVersion || !sameHistoryRange(activeRange, currentRange())) {
        pendingRefresh = true;
      } else if (!pendingRefresh) {
        reportLoadError("more", error);
      }
    }
  }

  function startLoad(operation) {
    if (loading) {
      if (operation === "refresh") pendingRefresh = true;
      return loadPromise;
    }
    const loadMoreButton = shadow.getElementById("history-load-more");
    const restoreLoadMoreFocus = operation === "more" && shadow.activeElement === loadMoreButton;
    loading = true;
    const work = (async () => {
      let action = operation;
      while (action) {
        if (action === "refresh") await performRefresh();
        else await performLoadMore();
        action = pendingRefresh ? "refresh" : null;
      }
    })();
    loadPromise = work.finally(() => {
      loading = false;
      loadPromise = null;
      inFlightPeriod = null;
      inFlightRange = null;
      inFlightOperation = null;
      inFlightDataVersion = null;
      syncLoadMore();
      if (restoreLoadMoreFocus && (!shadow.activeElement || shadow.activeElement === loadMoreButton)) {
        (loadMoreButton.hidden ? shadow.getElementById("history-count") : loadMoreButton)
          .focus({ preventScroll: true });
      }
    });
    syncLoadMore();
    return loadPromise;
  }

  function refresh() {
    return startLoad("refresh");
  }

  function ensureLoaded() {
    if (historyIsFresh()) return loadPromise ?? Promise.resolve();
    if (loading && inFlightOperation === "refresh" && inFlightPeriod === filters.period
      && inFlightDataVersion === dataVersion && sameHistoryRange(inFlightRange, currentRange())
      && !pendingRefresh) return loadPromise;
    return refresh();
  }

  function invalidate() {
    dataVersion += 1;
    loadedPeriod = null;
    syncLoadMore();
  }

  function loadMore() {
    if (loading || nextBefore === null || !historyIsFresh()
      || failedLoad === "refresh") {
      syncLoadMore();
      return loadPromise ?? Promise.resolve();
    }
    return startLoad("more");
  }

  function allEncounters() {
    return bundles.flatMap((bundle) => bundle.encounters);
  }

  function populateFilters() {
    const encounters = allEncounters();
    const species = new Map();
    for (const encounter of encounters) {
      if (!encounter.speciesId || species.has(encounter.speciesId)) continue;
      species.set(encounter.speciesId, speciesLabel(encounter));
    }

    populateSelect(
      shadow.getElementById("history-species"),
      [...species.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      ([id, label]) => [id, label]
    );
    populateSelect(
      shadow.getElementById("history-capsule"),
      [...new Set(encounters.map((encounter) => encounter.capsuleName).filter(Boolean))].sort()
    );
    populateSelect(shadow.getElementById("history-element"), distinctElements(encounters));

    filters.species = shadow.getElementById("history-species").value;
    filters.capsule = shadow.getElementById("history-capsule").value;
    filters.element = shadow.getElementById("history-element").value;
  }

  function populateLootSessions() {
    const select = shadow.getElementById("history-loot-session");
    const fragment = document.createDocumentFragment();
    const all = document.createElement("option");
    all.value = "*";
    all.textContent = "All loaded sessions";
    fragment.appendChild(all);

    bundles.forEach(({ session }, index) => {
      const option = document.createElement("option");
      option.value = session.sessionId;
      const kind = session.activityKind === "expedition" ? "Expedition" : "Hunt";
      option.textContent = `${kind} #${index + 1}`;
      fragment.appendChild(option);
    });
    select.replaceChildren(fragment);
    if (!bundles.some(({ session }) => session.sessionId === selectedLootSessionId)) {
      selectedLootSessionId = "*";
    }
    select.value = selectedLootSessionId;
  }

  function matchesEncounter(encounter) {
    if (filters.species !== "*" && encounter.speciesId !== filters.species) return false;
    if (filters.rarity !== "*" && encounter.quality !== filters.rarity) return false;
    if (filters.result !== "*" && encounter.captureResult !== filters.result) return false;
    if (filters.capsule !== "*" && encounter.capsuleName !== filters.capsule) return false;
    if (filters.element !== "*" && !(
      Array.isArray(encounter.elements) && encounter.elements.includes(filters.element)
    )) return false;
    if (filters.shiny === "yes" && !encounter.isShiny) return false;
    if (filters.shiny === "no" && encounter.isShiny) return false;
    return true;
  }

  function hasEncounterFilters() {
    return [
      filters.species,
      filters.rarity,
      filters.result,
      filters.capsule,
      filters.element,
      filters.shiny
    ].some((value) => value !== "*");
  }

  function filteredForBundle(bundle) {
    return bundle.encounters.filter(matchesEncounter);
  }

  function visibleBundles() {
    if (!hasEncounterFilters()) return bundles;
    return bundles.filter((bundle) => filteredForBundle(bundle).length > 0);
  }

  function filteredAttempts() {
    return allEncounters()
      .filter((encounter) => ["success", "failed"].includes(encounter.captureResult))
      .filter(matchesEncounter)
      .sort((left, right) => (right.captureAtMs || 0) - (left.captureAtMs || 0));
  }

  function rerenderKeepingFocus(row, rerender, selector, datasetKey, value) {
    const focused = shadow.activeElement === row;
    rerender();
    if (!focused) return;
    [...shadow.querySelectorAll(selector)]
      .find((candidate) => candidate.dataset[datasetKey] === String(value))
      ?.focus({ preventScroll: true });
  }

  function render() {
    for (const section of shadow.querySelectorAll("[data-history-panel]")) {
      section.hidden = section.dataset.historyPanel !== activeSubview;
    }

    shadow.getElementById("history-rarity-label").textContent =
      activeSubview === "loot" ? "Pokémon Rarity" : "Rarity";
    if (activeSubview === "pokemon") renderPokemon();
    else if (activeSubview === "attempts") renderAttempts();
    else if (activeSubview === "loot") renderLoot();
    else renderHunts();
  }

  function setStatus(text) {
    shadow.getElementById("history-count").textContent = text;
    syncLoadMore();
  }

  function syncLoadMore() {
    const button = shadow.getElementById("history-load-more");
    if (!button) return;
    const hadFocus = shadow.activeElement === button;
    const fresh = historyIsFresh();
    button.hidden = nextBefore === null || !fresh
      || failedLoad === "refresh";
    button.disabled = loading;
    button.textContent = loading ? "Loading…" : "Load More";
    const refreshButton = shadow.getElementById("history-refresh");
    refreshButton.disabled = loading;
    refreshButton.textContent = fresh ? "Refresh" : "Refresh •";
    refreshButton.title = fresh
      ? "Reload History from saved sessions"
      : "History data or period has changed; refresh to update";
    refreshButton.setAttribute("aria-label", refreshButton.title);
    refreshButton.classList.toggle("history-refresh-dirty", !fresh);
    shadow.getElementById("history-retry").disabled = loading;
    if (hadFocus && button.hidden) {
      shadow.getElementById("history-count").focus({ preventScroll: true });
    }
  }

  function renderHunts() {
    const rows = visibleBundles();
    setStatus(`${rows.length} ${rows.length === 1 ? "Hunt" : "Hunts"}${nextBefore !== null ? " · more available" : ""}`);
    const body = shadow.getElementById("history-hunts-body");
    const fragment = document.createDocumentFragment();

    for (const bundle of rows) {
      const filtered = hasEncounterFilters() ? filteredForBundle(bundle) : bundle.encounters;
      const breakdown = computeRarityBreakdown(filtered);
      const row = document.createElement("tr");
      row.className = "history-hunt-row";
      row.dataset.sessionId = bundle.session.sessionId;
      row.tabIndex = 0;
      row.setAttribute("aria-expanded", String(expandedHunts.has(bundle.session.sessionId)));
      row.title = "Click to expand Hunt details";

      const values = [
        formatHistoryDate(bundle.session.startedAtMs),
        formatHistoryDuration(bundle.metrics.activeMs),
        formatNumber(breakdown.seen),
        formatNumber(breakdown.captured),
        formatNumber(breakdown.shiny.captured),
        formatNumber(breakdown.rarities.legendary.captured),
        formatNumber(breakdown.rarities.mythical.captured)
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index >= 4) cell.classList.add("history-priority-cell");
        row.appendChild(cell);
      });

      const toggle = () => {
        if (expandedHunts.has(bundle.session.sessionId)) expandedHunts.delete(bundle.session.sessionId);
        else expandedHunts.add(bundle.session.sessionId);
        rerenderKeepingFocus(row, renderHunts, ".history-hunt-row", "sessionId", bundle.session.sessionId);
      };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        toggle();
      });
      fragment.appendChild(row);

      if (expandedHunts.has(bundle.session.sessionId)) {
        fragment.appendChild(createHuntDetailRow(bundle));
      }
    }

    body.replaceChildren(fragment);
  }

  function createHuntDetailRow(bundle) {
    const row = document.createElement("tr");
    row.className = "history-detail-row";
    const cell = document.createElement("td");
    cell.colSpan = 7;

    const endAt = Number.isFinite(bundle.session.endedAtMs)
      ? bundle.session.endedAtMs
      : bundle.session.lastActivityAtMs;
    const profit = bundle.metrics.gold - bundle.metrics.expenses;

    const grid = document.createElement("div");
    grid.className = "history-detail-grid";
    const detailValues = [
      ["Start", formatClock(bundle.session.startedAtMs)],
      ["End", formatClock(endAt)],
      ["Capture", formatRate(bundle.metrics.seenToCaptureRate)],
      ["XP/h You", bundle.metrics.trainerExpPerHour == null ? "—" : formatCompact(bundle.metrics.trainerExpPerHour)],
      ["XP/h Poké", bundle.metrics.pokemonExpPerHour == null ? "—" : formatCompact(bundle.metrics.pokemonExpPerHour)],
      ["$/h", bundle.metrics.goldPerHour == null ? "—" : formatCompact(bundle.metrics.goldPerHour)],
      ["Profit", formatCompact(profit)],
      ["Expenses", formatCompact(bundle.metrics.expenses)],
      ["Failed", formatNumber(bundle.metrics.failed)]
    ];

    detailValues.forEach(([label, value]) => {
      const item = document.createElement("span");
      const labelNode = document.createElement("b");
      labelNode.textContent = label;
      const valueNode = document.createElement("strong");
      valueNode.textContent = value;
      if (label === "Profit") {
        valueNode.className = profit < 0 ? "value-negative" : profit > 0 ? "value-positive" : "";
      }
      item.append(labelNode, valueNode);
      grid.appendChild(item);
    });

    const breakdown = computeRarityBreakdown(bundle.encounters);
    const fledLine = document.createElement("div");
    fledLine.className = "history-fled-line";
    const fledLabel = document.createElement("b");
    fledLabel.textContent = "Fled:";
    fledLine.appendChild(fledLabel);
    RARITIES.forEach(([key, label], index) => {
      if (index > 0) {
        const separator = document.createElement("i");
        separator.textContent = "·";
        fledLine.appendChild(separator);
      }
      const value = document.createElement("span");
      value.className = rarityClass(key);
      value.textContent = formatNumber(breakdown.rarities[key].failed);
      value.title = `${label} fled`;
      fledLine.appendChild(value);
    });

    const notables = createNotables(bundle);
    cell.append(grid, fledLine, notables);
    row.appendChild(cell);
    return row;
  }

  function createNotables(bundle) {
    const container = document.createElement("div");
    container.className = "history-notables";
    const controls = document.createElement("div");
    controls.className = "history-notable-controls";
    const label = document.createElement("b");
    label.textContent = "Notables:";
    controls.appendChild(label);

    const sessionId = bundle.session.sessionId;
    const selected = notableSelectionBySession.get(sessionId) || null;
    for (const rarity of NOTABLE_RARITIES) {
      const encounters = notableEncounters(bundle.encounters, rarity);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `history-notable-button ${rarityClass(rarity)}`;
      button.textContent = `${RARITY_SHORT.get(rarity)} ${formatNumber(encounters.length)}`;
      button.disabled = encounters.length === 0;
      button.classList.toggle("active", selected === rarity);
      button.setAttribute("aria-pressed", String(selected === rarity));
      button.addEventListener("click", () => {
        if (selected === rarity) notableSelectionBySession.delete(sessionId);
        else notableSelectionBySession.set(sessionId, rarity);
        renderHunts();
      });
      controls.appendChild(button);
    }

    container.appendChild(controls);
    if (selected) container.appendChild(createNotableList(bundle, selected));
    return container;
  }

  function createNotableList(bundle, rarity) {
    const wrap = document.createElement("div");
    wrap.className = "history-notable-list";
    const table = document.createElement("table");
    addColumnGroup(table, [
      "history-notable-time-col",
      "history-notable-pokemon-col",
      "history-notable-result-col",
      "history-notable-ball-col",
      "history-notable-chance-col",
      "history-notable-iv-col"
    ]);
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["At", "Pokémon", "Result", "Ball", "Chance", "IV"].forEach((label) => {
      const cell = document.createElement("th");
      cell.textContent = label;
      headRow.appendChild(cell);
    });
    head.appendChild(headRow);

    const body = document.createElement("tbody");
    for (const encounter of notableEncounters(bundle.encounters, rarity)) {
      const row = document.createElement("tr");
      if (encounter.isShiny) row.classList.add("encounter-row-shiny");
      const values = [
        formatAttemptTime(encounter.captureAtMs),
        `${speciesLabel(encounter)}${encounter.isShiny ? " *" : ""}`,
        encounter.captureResult === "success" ? "Cap." : "Fled",
        encounter.capsuleName || "—",
        formatRate(encounter.captureChance, 3),
        ivTotal(encounter) ?? "—"
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 1) cell.classList.add(rarityClass(rarity));
        if (index === 2) {
          cell.classList.add(encounter.captureResult === "success" ? "history-result-captured" : "history-result-fled");
        }
        row.appendChild(cell);
      });
      body.appendChild(row);
    }

    table.append(head, body);
    wrap.appendChild(table);
    return wrap;
  }

  function renderPokemon() {
    const groups = new Map();
    for (const bundle of bundles) {
      for (const encounter of bundle.encounters) {
        if (!matchesEncounter(encounter) || !encounter.speciesId) continue;
        const level = Number.isFinite(encounter.level) ? encounter.level : "?";
        const key = `${encounter.speciesId}|${level}`;
        if (!groups.has(key)) {
          groups.set(key, { key, sample: encounter, encounters: [], sessions: new Set() });
        }
        const group = groups.get(key);
        group.encounters.push(encounter);
        group.sessions.add(bundle.session.sessionId);
      }
    }

    const rows = [...groups.values()].map((group) => {
      const metrics = computeGroupMetrics(group.encounters);
      const breakdown = computeRarityBreakdown(group.encounters);
      return {
        key: group.key,
        name: speciesLabel(group.sample),
        level: group.sample.level ?? "—",
        hunts: group.sessions.size,
        encounters: group.encounters,
        breakdown,
        seen: metrics.seen,
        captured: metrics.captured,
        rate: metrics.seen ? metrics.captured / metrics.seen : null,
        xp: metrics.trainerExpPerCycleHour,
        dollar: metrics.dollarPerCycleHour,
        failed: metrics.failed,
        shinyFailed: breakdown.shiny.failed,
        legendaryFailed: breakdown.rarities.legendary.failed,
        mythicalFailed: breakdown.rarities.mythical.failed
      };
    }).sort((a, b) => b.seen - a.seen || a.name.localeCompare(b.name));

    setStatus(`${rows.length} Pokémon`);
    const body = shadow.getElementById("history-pokemon-body");
    const fragment = document.createDocumentFragment();
    for (const item of rows) {
      const row = document.createElement("tr");
      row.className = "history-pokemon-row";
      row.dataset.groupKey = item.key;
      row.tabIndex = 0;
      row.setAttribute("aria-expanded", String(expandedPokemon.has(item.key)));
      [
        item.name,
        item.level,
        formatNumber(item.seen),
        formatNumber(item.captured),
        formatRate(item.rate),
        item.xp == null ? "—" : formatCompact(item.xp),
        item.dollar == null ? "—" : formatCompact(item.dollar)
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      row.title = `${item.hunts} Hunts · ${formatNumber(item.failed)} Failed · ${formatNumber(item.shinyFailed)} Sh.F · ${formatNumber(item.legendaryFailed)} Leg.F · ${formatNumber(item.mythicalFailed)} Myt.F · click for rarity breakdown`;

      const toggle = () => {
        if (expandedPokemon.has(item.key)) expandedPokemon.delete(item.key);
        else expandedPokemon.add(item.key);
        rerenderKeepingFocus(row, renderPokemon, ".history-pokemon-row", "groupKey", item.key);
      };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        toggle();
      });
      fragment.appendChild(row);
      if (expandedPokemon.has(item.key)) fragment.appendChild(createPokemonRarityRow(item));
    }
    body.replaceChildren(fragment);
  }

  function createPokemonRarityRow(item) {
    const detailRow = document.createElement("tr");
    detailRow.className = "history-detail-row history-pokemon-detail-row";
    const cell = document.createElement("td");
    cell.colSpan = 7;
    const table = document.createElement("table");
    table.className = "history-pokemon-rarity-table";
    addColumnGroup(table, [
      "history-pokemon-rarity-name-col",
      "history-pokemon-rarity-metric-col",
      "history-pokemon-rarity-metric-col",
      "history-pokemon-rarity-metric-col",
      "history-pokemon-rarity-metric-col"
    ]);

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Rar.", "Seen", "Cap.", "Fail", "Rate"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    head.appendChild(headRow);

    const body = document.createElement("tbody");
    for (const [key] of RARITIES) {
      const metric = item.breakdown.rarities[key];
      const row = document.createElement("tr");
      row.className = rarityClass(key);
      const values = [
        RARITY_SHORT.get(key),
        formatNumber(metric.seen),
        formatNumber(metric.captured),
        formatNumber(metric.failed),
        formatRate(metric.seen ? metric.captured / metric.seen : null)
      ];
      values.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        row.appendChild(td);
      });
      body.appendChild(row);
    }

    table.append(head, body);
    cell.appendChild(table);
    detailRow.appendChild(cell);
    return detailRow;
  }

  function createLootSourceRow(entry) {
    const row = document.createElement("tr");
    row.className = "history-detail-row history-loot-detail-row";
    const cell = document.createElement("td");
    cell.colSpan = 3;
    const heading = document.createElement("strong");
    heading.textContent = "Pokémon sources";
    const table = document.createElement("table");
    table.className = "history-loot-sources-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["Pokémon", "Qty", "Drops"]) {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    }
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    for (const source of entry.sources) {
      const sourceRow = document.createElement("tr");
      for (const value of [speciesLabel({ speciesName: source.speciesName }), formatNumber(source.qty), formatNumber(source.drops)]) {
        const td = document.createElement("td");
        td.textContent = value;
        sourceRow.appendChild(td);
      }
      body.appendChild(sourceRow);
    }
    table.append(head, body);
    cell.append(heading, table);
    row.appendChild(cell);
    return row;
  }

  function presentLootItemCell(cell, itemId, catalog) {
    const metadata = catalog?.get?.(itemId);
    const name = typeof metadata?.name === "string" && metadata.name.trim()
      ? metadata.name.trim()
      : itemId;
    const rarityKey = lootItemRarity(metadata);
    const rarity = RARITIES.find(([key]) => key === rarityKey);
    const itemName = document.createElement("span");
    itemName.className = `history-loot-item-name ${rarity ? rarityClass(rarityKey) : ""}`.trim();
    itemName.textContent = name;
    itemName.title = itemId;
    const details = document.createElement("small");
    details.textContent = `${name === itemId ? "" : `${itemId} · `}${rarity ? `Rarity: ${rarity[1]}` : "Rarity unknown"}`;
    cell.replaceChildren(itemName, details);
  }

  function refreshLootCatalog() {
    if (activeSubview !== "loot") return;
    const catalog = getLootItemCatalog();
    const signature = lootItemCatalogSignature(cachedLootSummary?.items || [], catalog);
    if (signature === currentLootCatalogSignature) return;
    if (!lootRarityFilter.isAll()) {
      renderLoot({ preserveScroll: true, reuseSummary: true, catalog });
      return;
    }
    for (const row of shadow.querySelectorAll("#history-loot-body .history-loot-row")) {
      presentLootItemCell(row.cells[0], row.dataset.itemId, catalog);
    }
    currentLootCatalogSignature = signature;
  }

  function renderLoot({ preserveScroll = false, reuseSummary = false, catalog = getLootItemCatalog() } = {}) {
    const summary = reuseSummary && cachedLootSummary
      ? cachedLootSummary
      : aggregateLootHistory(bundles, {
          sessionId: selectedLootSessionId,
          matchesEncounter
        });
    cachedLootSummary = summary;
    const { totals, items, matchedSessions, matchedEncounters, lootedEncounters } = summary;
    currentLootCatalogSignature = lootItemCatalogSignature(items, catalog);
    const visibleItems = items.filter((entry) =>
      lootRarityFilter.matches(lootItemRarity(catalog?.get?.(entry.itemId)))
    );
    const scopeLabel = nextBefore !== null ? " · more sessions available" : "";
    const itemCount = lootRarityFilter.isAll()
      ? `${items.length} item types`
      : `${visibleItems.length}/${items.length} item types`;
    setStatus(`${itemCount} · ${matchedSessions}/${bundles.length} sessions matched${scopeLabel}`);
    shadow.getElementById("history-loot-coverage").textContent =
      `${formatNumber(matchedEncounters)} matched encounters · ${formatNumber(lootedEncounters)} loot rewards`;

    for (const [id, value] of [
      ["history-loot-gold", totals.directGold],
      ["history-loot-value", totals.lootSellValue],
      ["history-loot-autosell", totals.autoSellValue],
      ["history-loot-total", totals.total]
    ]) {
      const node = shadow.getElementById(id);
      node.textContent = formatCompact(value);
      node.title = formatNumber(value);
    }

    const body = shadow.getElementById("history-loot-body");
    const scrollContainer = shadow.querySelector(".history-loot-wrap");
    const previousScrollTop = preserveScroll ? scrollContainer?.scrollTop : null;
    const fragment = document.createDocumentFragment();

    for (const entry of visibleItems) {
      const row = document.createElement("tr");
      row.className = "history-loot-row";
      row.dataset.itemId = entry.itemId;
      row.tabIndex = 0;
      row.setAttribute("aria-expanded", String(expandedLoot.has(entry.itemId)));
      row.title = `${entry.itemId} · click for Pokémon sources`;

      const itemCell = document.createElement("td");
      presentLootItemCell(itemCell, entry.itemId, catalog);
      row.appendChild(itemCell);
      for (const value of [entry.qty, entry.drops]) {
        const cell = document.createElement("td");
        cell.textContent = formatNumber(value);
        row.appendChild(cell);
      }

      const toggle = () => {
        if (expandedLoot.has(entry.itemId)) expandedLoot.delete(entry.itemId);
        else expandedLoot.add(entry.itemId);
        rerenderKeepingFocus(row, () => renderLoot({ preserveScroll: true, reuseSummary: true }),
          ".history-loot-row", "itemId", entry.itemId);
      };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        toggle();
      });
      fragment.appendChild(row);
      if (expandedLoot.has(entry.itemId)) fragment.appendChild(createLootSourceRow(entry));
    }

    if (visibleItems.length === 0) {
      const empty = document.createElement("tr");
      empty.className = "history-loot-empty";
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.textContent = lootRarityFilter.isAll()
        ? "No item drops recorded in the selected encounters."
        : "No item drops match this item rarity in the selected encounters.";
      empty.appendChild(cell);
      fragment.appendChild(empty);
    }
    body.replaceChildren(fragment);
    if (preserveScroll && scrollContainer && previousScrollTop !== null) {
      scrollContainer.scrollTop = previousScrollTop;
    }
  }

  function renderAttempts() {
    const attempts = filteredAttempts();
    const visible = attempts.slice(0, attemptRenderCount);
    setStatus(`${attempts.length} ${attempts.length === 1 ? "Attempt" : "Attempts"}`);
    const body = shadow.getElementById("history-attempts-body");
    const fragment = document.createDocumentFragment();

    for (const encounter of visible) {
      const row = document.createElement("tr");
      row.className = encounter.isShiny ? "encounter-row-shiny history-attempt-row" : "history-attempt-row";
      row.dataset.encounterId = encounter.encounterId;
      row.tabIndex = 0;
      row.setAttribute("aria-expanded", String(expandedAttempts.has(encounter.encounterId)));
      const result = encounter.captureResult === "success" ? "Cap." : "Fled";
      const values = [
        formatAttemptTime(encounter.captureAtMs),
        `${speciesLabel(encounter)}${encounter.isShiny ? " *" : ""}`,
        result,
        encounter.capsuleName || "—",
        formatRate(encounter.captureChance, 3),
        ivTotal(encounter) ?? "—"
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 1) cell.classList.add(rarityClass(encounter.quality));
        if (index === 2) {
          cell.classList.add(encounter.captureResult === "success" ? "history-result-captured" : "history-result-fled");
        }
        row.appendChild(cell);
      });

      const toggle = () => {
        if (expandedAttempts.has(encounter.encounterId)) expandedAttempts.delete(encounter.encounterId);
        else expandedAttempts.add(encounter.encounterId);
        rerenderKeepingFocus(row, renderAttempts, ".history-attempt-row", "encounterId", encounter.encounterId);
      };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        toggle();
      });
      fragment.appendChild(row);

      if (expandedAttempts.has(encounter.encounterId)) {
        const detailRow = document.createElement("tr");
        detailRow.className = "history-detail-row";
        const detailCell = document.createElement("td");
        detailCell.colSpan = 6;
        const parts = [
          `${encounter.captureResult === "success" ? "Captured at" : "Fled at"}: ${formatClock(encounter.captureAtMs)}`,
          `Chance: ${formatRate(encounter.captureChance, 3)}`
        ];
        detailCell.textContent = parts.join(" · ");
        detailRow.appendChild(detailCell);
        fragment.appendChild(detailRow);
      }
    }

    body.replaceChildren(fragment);
  }

  return {
    refresh,
    ensureLoaded,
    invalidate,
    loadMore,
    refreshLootCatalog,
    getActiveSubview: () => activeSubview,
    setActiveSubview
  };
}
