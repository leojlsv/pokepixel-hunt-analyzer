import {
  RARITIES,
  formatCatchChance,
  formatCompact,
  formatDuration,
  formatNumber,
  formatRate,
  rarityClass,
  renderShinyCount,
  speciesLabel
} from "./ui-utils.js";
import {
  DEFAULT_ENCOUNTER_SORT,
  compareEncounters,
  formatCurrentHuntTimestamp,
  formatCaptureTimestamp,
  passesEncounterFilters,
  sortEncounters
} from "./encounter-list-model.js";
import { latestSpeciesEncounter } from "./hunt-view-model.js";
import {
  readCurrentRarityPreferences,
  saveCurrentRarityPreference
} from "./current-rarity-preferences.js";
import { createCurrentLootView } from "./current-loot-view.js";
import { createSegmentedEncounterList } from "./segmented-encounter-list.js";

const RARE_PLUS_KEYS = new Set(["rare", "epic", "legendary", "mythical"]);
const RARITY_LABELS = new Map(RARITIES);
export const CURRENT_LIST_PAGE_SIZE = 100;
const LIST_LOAD_THRESHOLD_PX = 48;
const DISPLAY_IV_KEYS = ["hp", "atk", "spa", "def", "spd", "spe"];

function genderInfo(value) {
  const key = String(value || "").trim().toLowerCase();
  if (["male", "m", "masculino", "♂"].includes(key)) {
    return { label: "♂", className: "gender-male", title: "Male" };
  }
  if (["female", "f", "feminino", "♀"].includes(key)) {
    return { label: "♀", className: "gender-female", title: "Female" };
  }
  return { label: "—", className: "", title: value || "Unknown" };
}

function ivValues(ivs) {
  if (!ivs || typeof ivs !== "object") return null;
  const values = [ivs.hp, ivs.atk, ivs.spa, ivs.def, ivs.spd, ivs.spe];
  return values.some(Number.isFinite) ? values : null;
}

function renderIvDisplay(cell, encounter) {
  const values = ivValues(encounter.ivs);
  if (!values) {
    cell.textContent = "—";
    return;
  }

  const total = Number.isFinite(encounter.ivTotal)
    ? encounter.ivTotal
    : values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const labels = ["hp", "atk", "spatk", "def", "spdef", "speed"];
  cell.append(document.createTextNode(`${total} (`));
  values.forEach((value, index) => {
    if (index > 0) cell.append(document.createTextNode("-"));
    const part = document.createElement("span");
    part.className = `iv-part iv-${labels[index]}`;
    part.textContent = Number.isFinite(value) ? String(value) : "—";
    cell.appendChild(part);
  });
  cell.append(document.createTextNode(")"));
}

function failedIvDisplay(encounter) {
  return Number.isFinite(encounter.ivTotal) ? String(encounter.ivTotal) : "—";
}

function pokemonLabel(count) {
  return `${count} ${count === 1 ? "Pokémon" : "Pokémons"}`;
}

function parseFilterNumber(input) {
  if (!input?.value) return null;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function scheduleFrame(callback) {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(callback);
  } else {
    setTimeout(callback, 0);
  }
}

function createListState(prefix) {
  const state = {
    prefix,
    // `null` means All (*), including an unexpected future/unknown rarity.
    filters: { rarities: null, qualityMin: null, ivMin: null, shiny: "*" },
    sort: { ...DEFAULT_ENCOUNTER_SORT },
    byId: new Map(),
    shinyCount: 0,
    visible: null,
    rows: new Map(),
    expandedIds: new Set(),
    renderToken: 0,
    rendering: false,
    // Bounded DOM viewport, independent of the full session's rank list.
    pageStart: 0,
    // Head inserts before a deep page shift its 100-row navigation grid.
    // A nonzero origin creates one short leading page, not overlapping pages.
    pageOrigin: 0,
    renderedCount: 0
  };
  state.visible = createSegmentedEncounterList((left, right) =>
    compareEncounters(left, right, state.sort));
  return state;
}

function encounterChanged(previous, next) {
  if (!previous) return true;
  return previous.updatedAtMs !== next.updatedAtMs ||
    previous.captureAtMs !== next.captureAtMs ||
    // Raw/legacy source corrections do not necessarily bump updatedAtMs.
    // Capture UI displays rarity and EACH IV, not just qualityMultiplier/
    // ivTotal. Full-source reconciliation must update those visible fields.
    previous.quality !== next.quality ||
    previous.qualityMultiplier !== next.qualityMultiplier ||
    previous.ivTotal !== next.ivTotal ||
    DISPLAY_IV_KEYS.some(key => !Object.is(previous.ivs?.[key], next.ivs?.[key])) ||
    previous.isShiny !== next.isShiny ||
    previous.capsuleName !== next.capsuleName ||
    previous.captureChance !== next.captureChance ||
    previous.speciesId !== next.speciesId ||
    previous.speciesName !== next.speciesName ||
    previous.gender !== next.gender ||
    previous.nature !== next.nature;
}

export function createCurrentView(shadow, {
  getLootItemCatalog = () => null,
  getCatchChanceDecimals = () => 3
} = {}) {
  let currentSessionId;
  let currentHuntStartedAtMs = null;
  let lastEncounterSnapshotVersion = -1;
  let lastTitleMode = null;
  const savedRarities = readCurrentRarityPreferences();
  const lists = {
    captured: createListState("captured"),
    failed: createListState("failed")
  };
  const lootView = createCurrentLootView(shadow, { getLootItemCatalog });

  bindListControls("captured");
  bindListControls("failed");
  renderHudSummary({ seen: 0, seenPerHour: null });

  function bindRarityFilter(prefix, state) {
    const root = shadow.getElementById(`${prefix}-rarity`);
    const all = root.querySelector("[data-rarity-all]");
    const options = [...root.querySelectorAll("[data-rarity-value]")];
    const label = shadow.getElementById(`${prefix}-rarity-label`);

    const restored = savedRarities[prefix];
    if (restored !== null) {
      const selected = new Set(restored);
      for (const input of options) input.checked = selected.has(input.dataset.rarityValue);
    }

    const sync = () => {
      const selected = options
        .filter((input) => input.checked)
        .map((input) => input.dataset.rarityValue);
      const allSelected = selected.length === options.length;

      all.checked = allSelected;
      state.filters.rarities = allSelected ? null : new Set(selected);

      if (allSelected) {
        label.textContent = "All (*)";
      } else if (selected.length === 0) {
        label.textContent = "None";
      } else if (selected.length === 1) {
        label.textContent = RARITY_LABELS.get(selected[0]) || selected[0];
      } else {
        label.textContent = `${selected.length} selected`;
      }
    };

    root.addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;

      if (input.hasAttribute("data-rarity-all")) {
        for (const option of options) option.checked = input.checked;
      }

      sync();
      saveCurrentRarityPreference(prefix, state.filters.rarities === null
        ? null : [...state.filters.rarities]);
      rebuildEncounterList(prefix);
    });

    sync();
  }

  function bindListControls(prefix) {
    const state = lists[prefix];

    bindRarityFilter(prefix, state);
    shadow.getElementById(`${prefix}-shiny`).addEventListener("change", (event) => {
      state.filters.shiny = event.target.value;
      rebuildEncounterList(prefix);
    });
    shadow.getElementById(`${prefix}-quality`)?.addEventListener("input", (event) => {
      state.filters.qualityMin = parseFilterNumber(event.target);
      rebuildEncounterList(prefix);
    });
    shadow.getElementById(`${prefix}-iv`).addEventListener("input", (event) => {
      state.filters.ivMin = parseFilterNumber(event.target);
      rebuildEncounterList(prefix);
    });

    for (const header of shadow.querySelectorAll(`[data-encounter-sort="${prefix}"]`)) {
      const activateSort = () => {
        const key = header.dataset.sortKey;
        if (state.sort.key === key) {
          state.sort.direction = state.sort.direction === "desc" ? "asc" : "desc";
        } else {
          state.sort = { key, direction: "desc" };
        }
        updateSortIndicators(prefix);
        rebuildEncounterList(prefix, { resetScroll: false });
      };
      header.addEventListener("click", activateSort);
      header.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activateSort();
      });
    }

    const tableWrap = shadow.getElementById(`${prefix}-body`).closest(".table-wrap");
    tableWrap?.addEventListener("scroll", () => {
      if (state.rendering || tableWrap.scrollTop <= 0 ||
          nextPageStart(state) >= state.visible.length) return;
      const remaining = tableWrap.scrollHeight - tableWrap.scrollTop - tableWrap.clientHeight;
      if (remaining <= LIST_LOAD_THRESHOLD_PX) {
        showEncounterPage(prefix, nextPageStart(state),
          { resetScroll: true });
      }
    }, { passive: true });

    shadow.getElementById(prefix + "-page-prev").addEventListener("click", () => {
      showEncounterPage(prefix, previousPageStart(state),
        { resetScroll: true });
    });
    shadow.getElementById(prefix + "-page-next").addEventListener("click", () => {
      showEncounterPage(prefix, nextPageStart(state),
        { resetScroll: true });
    });
    const jump = shadow.getElementById(prefix + "-page-jump");
    const jumpToRow = () => {
      const rowNumber = Number(jump.value);
      if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) {
        jump.value = state.visible.length ? String(state.pageStart + 1) : "";
        return;
      }
      showEncounterPage(prefix, Math.floor((rowNumber - 1) / CURRENT_LIST_PAGE_SIZE) *
        CURRENT_LIST_PAGE_SIZE, { resetScroll: true, alignLastPage: true });
      jump.value = state.visible.length ? String(state.pageStart + 1) : "";
    };
    shadow.getElementById(prefix + "-page-go").addEventListener("click", jumpToRow);
    jump.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      jumpToRow();
    });

    updateSortIndicators(prefix);
    updatePageControls(prefix);
  }

  function render({
    metrics,
    encounters = [],
    sessionId = null,
    encounterSnapshotVersion = 0,
    lootDataRevision = encounterSnapshotVersion,
    encounterDelta = null,
    currentSessionSpecies = null
  }) {
    const sessionChanged = currentSessionId !== sessionId;
    const previousListVersion = lastEncounterSnapshotVersion;
    const encounterSnapshotChanged =
      sessionChanged || lastEncounterSnapshotVersion !== encounterSnapshotVersion;
    currentSessionId = sessionId;
    currentHuntStartedAtMs = Number.isFinite(metrics?.startedAtMs) ? metrics.startedAtMs : null;
    lastEncounterSnapshotVersion = encounterSnapshotVersion;

    renderMetrics(metrics);
    renderRarities(metrics);
    lootView.render({
      sessionId, lootDataRevision, encounters,
      changedRows: encounterDelta?.changes,
      changedRowsFromRevision: encounterDelta?.fromRevision
    });

    const titleMode = metrics?.activityKind === "expedition" && metrics?.status === "running"
      ? "expedition" : "hunt";
    if (encounterSnapshotChanged || titleMode !== lastTitleMode) {
      const heading = shadow.querySelector(".status-row > span");
      const latestTarget = titleMode === "expedition" ? null : currentSessionSpecies || latestSpeciesEncounter(encounters);
      heading.textContent = titleMode === "expedition"
        ? "EXPEDITION" : latestTarget ? speciesLabel(latestTarget) : "Hunt";
      lastTitleMode = titleMode;
    }
    if (!encounterSnapshotChanged) return;

    // Ordinary terminal updates add one row; preserve the existing sort and
    // rendered DOM instead of regrouping every encounter accumulated in the Hunt.
    if (!sessionChanged && encounterDelta?.fromListVersion === previousListVersion
      && encounterDelta.toListVersion === encounterSnapshotVersion
      && applyTerminalDelta(encounterDelta.changes)) return;

    const grouped = { captured: [], failed: [] };
    for (const encounter of encounters) {
      if (encounter.captureResult === "success") grouped.captured.push(encounter);
      else if (encounter.captureResult === "failed") grouped.failed.push(encounter);
    }

    syncEncounterData("captured", grouped.captured, sessionChanged);
    syncEncounterData("failed", grouped.failed, sessionChanged);
    for (const prefix of ["captured", "failed"]) {
      lists[prefix].shinyCount = grouped[prefix].filter((encounter) => encounter.isShiny).length;
    }
    updateShinyBadge("captured", lists.captured.shinyCount);
    updateShinyBadge("failed", lists.failed.shinyCount);
  }

  function applyTerminalDelta(changes) {
    if (!Array.isArray(changes) || lists.captured.rendering || lists.failed.rendering) return false;
    const additions = { captured: [], failed: [] };
    for (const change of changes) {
      const previous = change?.previous;
      const next = change?.next;
      const priorGroup = previous?.captureResult === "success" ? "captured"
        : previous?.captureResult === "failed" ? "failed" : null;
      const nextGroup = next?.captureResult === "success" ? "captured"
        : next?.captureResult === "failed" ? "failed" : null;
      // Corrections, removals and result changes remain on the complete safe
      // reconciliation path, which also preserves focus and expansion state.
      if (priorGroup) return false;
      if (nextGroup) {
        if (!next?.encounterId || lists[nextGroup].byId.has(next.encounterId)) return false;
        additions[nextGroup].push(next);
      }
    }
    for (const prefix of ["captured", "failed"]) {
      const state = lists[prefix];
      for (const encounter of additions[prefix]) {
        state.byId.set(encounter.encounterId, encounter);
        if (encounter.isShiny) state.shinyCount += 1;
        upsertVisibleEncounter(prefix, encounter, { knownNew: true });
      }
      updateCount(prefix);
      updateShinyBadge(prefix, state.shinyCount);
    }
    return true;
  }

  function renderHudSummary(metrics) {
    const hudSummary = shadow.querySelector(".hud-xp");
    hudSummary.querySelector("span").textContent = formatNumber(metrics.seen);
    hudSummary.querySelector("strong").textContent = metrics.seenPerHour == null
      ? "(—/h)"
      : `(${formatNumber(metrics.seenPerHour)}/h)`;
  }

  function renderMetrics(metrics) {
    shadow.getElementById("hunt-time").textContent = formatDuration(metrics.activeMs);
    shadow.getElementById("trainer-exp-hour").textContent = metrics.trainerExpPerHour == null
      ? "—" : formatCompact(metrics.trainerExpPerHour);
    shadow.getElementById("trainer-exp-total").textContent = formatCompact(metrics.trainerExp);
    shadow.getElementById("pokemon-exp-hour").textContent = metrics.pokemonExpPerHour == null
      ? "—" : formatCompact(metrics.pokemonExpPerHour);
    shadow.getElementById("pokemon-exp-total").textContent = formatCompact(metrics.pokemonExp);
    shadow.getElementById("dollars-total").textContent = formatCompact(metrics.gold);
    shadow.getElementById("dollars-hour").textContent = metrics.goldPerHour == null
      ? "—" : formatCompact(metrics.goldPerHour);
    shadow.getElementById("expenses-total").textContent = formatCompact(metrics.expenses);

    // metrics.gold already includes realized capture auto-sell proceeds
    // (`capture.success.auto_sell_value`) in addition to kill gold.
    const profit = metrics.gold - metrics.expenses;
    const profitTotal = shadow.getElementById("profit-total");
    profitTotal.textContent = formatCompact(profit);
    profitTotal.style.color = profit < 0 ? "#ef8b82" : profit > 0 ? "#70dfaa" : "";

    shadow.getElementById("seen").textContent = formatNumber(metrics.seen);
    shadow.getElementById("captured").textContent = formatNumber(metrics.captured);
    shadow.getElementById("failed").textContent = formatNumber(metrics.failed);
    shadow.getElementById("capture-rate").textContent = formatRate(metrics.seenToCaptureRate);

    const status = metrics.status === "running"
      ? "Running"
      : metrics.status === "paused" ? "Paused" : "Waiting";
    shadow.getElementById("hunt-status").textContent = status;

    const pauseButton = shadow.getElementById("pause-resume");
    pauseButton.disabled = !["running", "paused"].includes(metrics.status);
    pauseButton.dataset.action = metrics.status === "running" ? "pause" : "resume";
    pauseButton.textContent = metrics.status === "running" ? "Pause" : "Resume";
    shadow.getElementById("end-hunt").disabled = metrics.status === "waiting";

    renderHudSummary(metrics);
  }

  function renderRarities(metrics) {
    let rarePlusFailed = 0;
    let shinySeen = 0;

    for (const [key] of RARITIES) {
      const rarity = metrics.rarities[key];
      const row = shadow.querySelector(`[data-rarity="${key}"]`);
      renderShinyCount(row.querySelector('[data-field="seen"]'), rarity.seen, rarity.shinySeen);
      renderShinyCount(
        row.querySelector('[data-field="captured"]'),
        rarity.captured,
        rarity.shinyCaptured
      );
      renderShinyCount(
        row.querySelector('[data-field="failed"]'),
        rarity.failed,
        rarity.shinyFailed
      );
      row.querySelector('[data-field="rate"]').textContent = formatRate(
        rarity.seen ? rarity.captured / rarity.seen : null
      );

      shadow.getElementById(`hud-${key}`).textContent = String(rarity.captured || 0);
      shinySeen += rarity.shinySeen || 0;
      if (RARE_PLUS_KEYS.has(key)) rarePlusFailed += rarity.failed || 0;
    }

    shadow.getElementById("rare-failed-count").textContent = `R+ fail ${rarePlusFailed}`;
    updateShinyBadge("rarity", shinySeen);
  }

  function updateShinyBadge(prefix, count) {
    const badge = shadow.getElementById(`${prefix}-shiny-count`);
    if (!badge) return;
    badge.hidden = !(count > 0);
    badge.textContent = `✦ ${formatNumber(count)}`;
  }

  function syncEncounterData(prefix, matching, reset) {
    const state = lists[prefix];
    const nextById = new Map();
    const changed = [];

    for (const encounter of matching) {
      nextById.set(encounter.encounterId, encounter);
      if (encounterChanged(state.byId.get(encounter.encounterId), encounter)) {
        changed.push(encounter);
      }
    }

    let removed = state.byId.size > nextById.size;
    if (!removed) {
      for (const encounterId of state.byId.keys()) {
        if (!nextById.has(encounterId)) {
          removed = true;
          break;
        }
      }
    }

    state.byId = nextById;
    for (const expandedId of [...state.expandedIds]) {
      if (!state.byId.has(expandedId)) state.expandedIds.delete(expandedId);
    }

    if (reset || removed || state.rendering) {
      if (reset) state.expandedIds.clear();
      rebuildEncounterList(prefix, { resetScroll: reset || removed });
      return;
    }

    for (const encounter of changed) {
      upsertVisibleEncounter(prefix, encounter);
    }

    updateCount(prefix);
  }

  function updateSortIndicators(prefix) {
    const state = lists[prefix];
    for (const header of shadow.querySelectorAll(`[data-encounter-sort="${prefix}"]`)) {
      const indicator = header.querySelector("[data-sort-indicator]");
      header.setAttribute("aria-sort", header.dataset.sortKey !== state.sort.key
        ? "none" : state.sort.direction === "asc" ? "ascending" : "descending");
      if (!indicator) continue;
      indicator.textContent = header.dataset.sortKey === state.sort.key
        ? state.sort.direction === "desc" ? "▼" : "▲"
        : "";
    }
  }

  function rebuildEncounterList(prefix, { resetScroll = true } = {}) {
    const state = lists[prefix];
    const priorAnchorId = resetScroll
      ? null : state.visible.get(state.pageStart)?.encounterId ?? null;

    state.visible.replaceSorted(sortEncounters(
      [...state.byId.values()].filter((encounter) => passesEncounterFilters(encounter, state.filters)),
      state.sort
    ));
    updateCount(prefix);
    const anchorRank = priorAnchorId
      ? state.visible.findIndex((item) => item.encounterId === priorAnchorId) : -1;
    // Refilter/re-sort is a new ordering. Select the canonical full-width
    // block CONTAINING the old anchor rather than opening a 1-row tail.
    showEncounterPage(prefix, resetScroll ? 0
      : anchorRank >= 0 ? Math.floor(anchorRank / CURRENT_LIST_PAGE_SIZE) *
        CURRENT_LIST_PAGE_SIZE : Math.floor(state.pageStart / CURRENT_LIST_PAGE_SIZE) *
        CURRENT_LIST_PAGE_SIZE,
    { resetScroll, alignLastPage: true });
  }

  function nextPageStart(state) {
    return state.pageStart === 0 && state.pageOrigin > 0
      ? state.pageOrigin : state.pageStart + CURRENT_LIST_PAGE_SIZE;
  }

  function previousPageStart(state) {
    return state.pageStart <= state.pageOrigin ? 0
      : state.pageStart - CURRENT_LIST_PAGE_SIZE;
  }

  function updatePageControls(prefix) {
    const state = lists[prefix];
    const total = state.visible.length;
    const start = total ? state.pageStart + 1 : 0;
    const end = total ? Math.min(nextPageStart(state), total) : 0;
    const status = total
      ? formatNumber(start) + "–" + formatNumber(end) + " de " + formatNumber(total)
      : "0 de 0";
    shadow.getElementById(prefix + "-page-status").textContent = status;
    shadow.getElementById(prefix + "-page-prev").disabled = state.pageStart <= 0;
    shadow.getElementById(prefix + "-page-next").disabled =
      nextPageStart(state) >= total;
    const input = shadow.getElementById(prefix + "-page-jump");
    input.max = String(total);
    // Background capture events can arrive while someone is typing a long
    // rank in this field. Never rewrite their in-progress numeric entry.
    if (shadow.activeElement !== input) {
      input.value = total ? String(start) : "";
    }
    shadow.getElementById(prefix + "-page-go").disabled = total === 0;
    // All entries are already mounted when there is only one page. Avoid
    // displaying five inert navigation controls below a ten-row/empty list.
    const controls = shadow.getElementById(prefix + "-page-prev")
      .closest(".encounter-page-controls");
    const singlePage = total <= CURRENT_LIST_PAGE_SIZE && state.pageStart === 0;
    if (singlePage && !controls.hidden && controls.contains(shadow.activeElement)) {
      shadow.querySelector(`[data-encounter-sort="${prefix}"]`)
        ?.focus({ preventScroll: true });
    }
    controls.hidden = singlePage;
  }

  function showEncounterPage(prefix, requestedStart = 0, {
    resetScroll = true, alignLastPage = false
  } = {}) {
    const state = lists[prefix];
    const body = shadow.getElementById(prefix + "-body");
    const tableWrap = body.closest(".table-wrap");
    // A jump beyond the final item lands on the LAST FULL page, not a
    // nearly empty one-row window at rank N-1.
    const maxStart = state.visible.length
      ? Math.floor((state.visible.length - 1) / CURRENT_LIST_PAGE_SIZE) *
        CURRENT_LIST_PAGE_SIZE : 0;
    // Incremental head insertions can preserve an anchored page at a rank
    // that is NOT divisible by 100, including a partial final page. Prev/Next
    // must be inverse operations on that offset grid. Only an explicit Go
    // normalizes an out-of-range jump to the canonical final block.
    const maxAllowedStart = alignLastPage ? maxStart :
      Math.max(0, state.visible.length - 1);
    const pageStart = Math.min(Math.max(0, Math.trunc(requestedStart) || 0),
      maxAllowedStart);
    if (alignLastPage) state.pageOrigin = 0;
    const previousScrollTop = tableWrap?.scrollTop || 0;
    const focusedElement = shadow.activeElement;
    const focusedId = state.rows.has(focusedElement?.dataset?.encounterId)
      ? focusedElement.dataset.encounterId : null;
    const token = ++state.renderToken;
    state.pageStart = pageStart;
    state.renderedCount = 0;
    state.rendering = true;
    state.rows.clear();
    body.replaceChildren();
    if (resetScroll && tableWrap) tableWrap.scrollTop = 0;
    updatePageControls(prefix);

    scheduleFrame(() => {
      if (token !== state.renderToken) return;
      const fragment = document.createDocumentFragment();
      const end = Math.min(nextPageStart(state), state.visible.length);
      for (let index = pageStart; index < end; index += 1) {
        const encounter = state.visible.get(index);
        const main = createEncounterRow(prefix, encounter);
        const rowState = { main, detail: null };
        state.rows.set(encounter.encounterId, rowState);
        fragment.appendChild(main);

        if (prefix === "captured" && state.expandedIds.has(encounter.encounterId)) {
          const detail = createDetailRow(prefix, encounter);
          rowState.detail = detail;
          main.setAttribute("aria-expanded", "true");
          fragment.appendChild(detail);
        }
      }

      body.replaceChildren(fragment);
      state.renderedCount = end - pageStart;
      state.rendering = false;
      if (!resetScroll && tableWrap) {
        tableWrap.scrollTop = Math.min(
          previousScrollTop,
          Math.max(0, tableWrap.scrollHeight - tableWrap.clientHeight)
        );
      } else if (resetScroll && shadow.host?.dataset?.uiMode === "mobile") {
        // On mobile the whole view, not this table-wrap, owns vertical scroll.
        // Bring the selected 100-row window's header back into view.
        tableWrap?.scrollIntoView?.({ block: "start", inline: "nearest" });
      }
      if (focusedId) {
        const currentFocus = shadow.activeElement;
        // Do not steal focus if a user reached a different control while
        // this scheduled frame was pending.
        if (!currentFocus || currentFocus === focusedElement ||
            currentFocus.isConnected === false) {
          const target = state.rows.get(focusedId)?.main ||
            state.rows.values().next().value?.main;
          target?.focus({ preventScroll: true });
        }
      }
    });
  }

  function upsertVisibleEncounter(prefix, encounter, { knownNew = false } = {}) {
    const state = lists[prefix];
    const existingIndex = knownNew ? -1 : state.visible.findIndex((item) => item.encounterId === encounter.encounterId);

    if (existingIndex >= 0) {
      const old = state.visible.get(existingIndex);
      // A correction that remains in the same sort position and still passes
      // the active filters only needs to refresh its own rendered row. Sorting
      // and recreating up to thousands of DOM rows for a field-only update
      // produced long-Hunt main-thread work unrelated to the visible change.
      if (passesEncounterFilters(encounter, state.filters) &&
          compareEncounters(old, encounter, state.sort) === 0) {
        state.visible.set(existingIndex, encounter);
        const rendered = state.rows.get(encounter.encounterId);
        if (rendered) {
          const hadFocus = shadow.activeElement === rendered.main;
          const replacement = createEncounterRow(prefix, encounter);
          if (rendered.detail) {
            const detail = createDetailRow(prefix, encounter);
            rendered.detail.replaceWith(detail);
            rendered.detail = detail;
            replacement.setAttribute("aria-expanded", "true");
          }
          rendered.main.replaceWith(replacement);
          rendered.main = replacement;
          if (hadFocus) replacement.focus({ preventScroll: true });
        }
        return;
      }
      rebuildEncounterList(prefix, { resetScroll: false });
      return;
    }

    if (!passesEncounterFilters(encounter, state.filters)) return;

    // New rows update the canonical sorted ranks, but ONLY the selected
    // 100-row viewport owns DOM nodes. A head insert before a deep page
    // advances its absolute rank to preserve the same visible encounters.
    const low = state.visible.insert(encounter);
    if (low < state.pageStart) {
      state.pageStart++;
      state.pageOrigin = (state.pageOrigin + 1) % CURRENT_LIST_PAGE_SIZE;
      updatePageControls(prefix);
      return;
    }
    if (state.pageStart === 0 && state.pageOrigin > 0 && low < state.pageOrigin) {
      state.pageOrigin = (state.pageOrigin + 1) % CURRENT_LIST_PAGE_SIZE;
    }
    const pageEnd = Math.min(nextPageStart(state), state.visible.length);
    if (low >= pageEnd) {
      updatePageControls(prefix);
      return;
    }

    const body = shadow.getElementById(`${prefix}-body`);
    const main = createEncounterRow(prefix, encounter);
    const rowState = { main, detail: null };
    state.rows.set(encounter.encounterId, rowState);

    let nextRow = null;
    for (let index = low + 1; index < pageEnd; index += 1) {
      nextRow = state.rows.get(state.visible.get(index).encounterId)?.main || null;
      if (nextRow) break;
    }
    if (nextRow) body.insertBefore(main, nextRow);
    else body.appendChild(main);

    if (prefix === "captured" && state.expandedIds.has(encounter.encounterId)) {
      const detail = createDetailRow(prefix, encounter);
      rowState.detail = detail;
      main.setAttribute("aria-expanded", "true");
      main.after(detail);
    }

    const overflowEncounter = state.visible.get(pageEnd);
    if (overflowEncounter) {
      const overflowRows = state.rows.get(overflowEncounter.encounterId);
      const focusedOverflow = shadow.activeElement === overflowRows?.main;
      overflowRows?.detail?.remove();
      overflowRows?.main.remove();
      state.rows.delete(overflowEncounter.encounterId);
      if (focusedOverflow) {
        const lastRetainedId = state.visible.get(pageEnd - 1)?.encounterId;
        const survivor = state.rows.get(lastRetainedId)?.main || main;
        survivor.focus({ preventScroll: true });
      }
    }

    state.renderedCount = pageEnd - state.pageStart;
    updatePageControls(prefix);
  }

  function createEncounterRow(prefix, encounter) {
    const row = document.createElement("tr");
    row.dataset.encounterId = encounter.encounterId;
    if (encounter.isShiny) row.classList.add("encounter-row-shiny");

    const pokemonCell = document.createElement("td");
    pokemonCell.className = rarityClass(encounter.quality);
    pokemonCell.textContent = `${speciesLabel(encounter)}${encounter.isShiny ? " *" : ""}`;

    if (prefix === "failed") {
      row.classList.add("failed-static-row");

      const ivCell = document.createElement("td");
      ivCell.className = "iv-cell";
      ivCell.textContent = failedIvDisplay(encounter);

      const capsuleCell = document.createElement("td");
      capsuleCell.textContent = encounter.capsuleName || "—";
      capsuleCell.title = encounter.capsuleName || "Unknown Pokéball";

      const chanceCell = document.createElement("td");
      chanceCell.className = "chance-cell";
      chanceCell.textContent = formatCatchChance(encounter.captureChance, getCatchChanceDecimals());

      const timestampCell = document.createElement("td");
      timestampCell.className = "timestamp-cell";
      timestampCell.textContent = formatCurrentHuntTimestamp(
        encounter.captureAtMs,
        currentHuntStartedAtMs
      );
      timestampCell.title = formatCaptureTimestamp(encounter.captureAtMs);

      row.append(pokemonCell, ivCell, capsuleCell, chanceCell, timestampCell);
      return row;
    }

    row.tabIndex = 0;
    row.setAttribute("aria-expanded", "false");
    row.title = "Click to show encounter details";
    row.style.cursor = "pointer";

    const gender = genderInfo(encounter.gender);

    const genderCell = document.createElement("td");
    genderCell.className = `gender ${gender.className}`.trim();
    genderCell.textContent = gender.label;
    genderCell.title = gender.title;

    const natureCell = document.createElement("td");
    natureCell.textContent = encounter.nature || "—";

    const qualityCell = document.createElement("td");
    qualityCell.textContent = Number.isFinite(encounter.qualityMultiplier)
      ? encounter.qualityMultiplier.toFixed(2)
      : "—";

    const ivCell = document.createElement("td");
    ivCell.className = "iv-cell";
    renderIvDisplay(ivCell, encounter);

    row.append(pokemonCell, genderCell, natureCell, qualityCell, ivCell);
    row.addEventListener("click", () => toggleEncounterDetail(prefix, encounter.encounterId));
    row.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      toggleEncounterDetail(prefix, encounter.encounterId);
    });
    return row;
  }

  function createDetailRow(prefix, encounter) {
    const row = document.createElement("tr");
    row.dataset.detailFor = encounter.encounterId;

    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.style.cssText = "height:auto;padding:6px 9px;background:#22231f;color:#c7c3b7;font-size:10px;border-bottom:1px solid #47473f;";

    const content = document.createElement("div");
    content.style.cssText = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;white-space:normal;";

    const addDetail = (label, value) => {
      const item = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      strong.style.color = "#c0ad72";
      item.append(strong, document.createTextNode(value || "—"));
      content.appendChild(item);
      return item;
    };

    addDetail(
      prefix === "captured" ? "Captured at" : "Fled at",
      formatCaptureTimestamp(encounter.captureAtMs)
    );
    addDetail("Capsule", encounter.capsuleName || "—");
    if (prefix === "captured") {
      addDetail("Chance", formatCatchChance(encounter.captureChance, getCatchChanceDecimals()))
        .dataset.catchChanceDetail = "true";
    }

    cell.appendChild(content);
    row.appendChild(cell);
    return row;
  }

  function toggleEncounterDetail(prefix, encounterId) {
    if (prefix !== "captured") return;
    const state = lists[prefix];
    const rowState = state.rows.get(encounterId);
    const encounter = state.byId.get(encounterId);
    if (!rowState || !encounter) return;

    if (state.expandedIds.has(encounterId)) {
      state.expandedIds.delete(encounterId);
      rowState.detail?.remove();
      rowState.detail = null;
      rowState.main.setAttribute("aria-expanded", "false");
      return;
    }

    state.expandedIds.add(encounterId);
    const detail = createDetailRow(prefix, encounter);
    rowState.detail = detail;
    rowState.main.setAttribute("aria-expanded", "true");
    rowState.main.after(detail);
  }

  function updateCount(prefix) {
    shadow.getElementById(`${prefix}-count`).textContent = pokemonLabel(lists[prefix].visible.length);
  }

  function suspend() {
    // Called ONLY while Current is hidden. Retain the small filter/sort
    // settings and listeners, but drop per-encounter references and DOM.
    // Reopen must force ONE sorted hydration, not 91k incremental insertions.
    currentSessionId = undefined;
    currentHuntStartedAtMs = null;
    lastEncounterSnapshotVersion = -1;
    lastTitleMode = null;
    for (const prefix of ["captured", "failed"]) {
      const state = lists[prefix];
      state.renderToken += 1; // Fence queued requestAnimationFrame callbacks.
      state.rendering = false;
      state.renderedCount = 0;
      state.pageStart = 0;
      state.pageOrigin = 0;
      state.byId.clear();
      state.visible.replaceSorted([]);
      state.rows.clear();
      state.expandedIds.clear();
      state.shinyCount = 0;
      shadow.getElementById(prefix + "-body").replaceChildren();
      updatePageControls(prefix);
    }
    lootView.suspend();
  }

  function retentionSnapshot() {
    return {
      captured: {
        cachedRows: lists.captured.byId.size,
        sortedRows: lists.captured.visible.length,
        renderedRows: lists.captured.rows.size,
        pageStart: lists.captured.pageStart,
        pageOrigin: lists.captured.pageOrigin,
        pageSize: CURRENT_LIST_PAGE_SIZE
      },
      failed: {
        cachedRows: lists.failed.byId.size,
        sortedRows: lists.failed.visible.length,
        renderedRows: lists.failed.rows.size,
        pageStart: lists.failed.pageStart,
        pageOrigin: lists.failed.pageOrigin,
        pageSize: CURRENT_LIST_PAGE_SIZE
      },
      loot: lootView.retentionSnapshot()
    };
  }

  function refreshCatchChance() {
    for (const [prefix, state] of Object.entries(lists)) {
      for (const [encounterId, row] of state.rows) {
        const encounter = state.byId.get(encounterId);
        if (!encounter) continue;
        const value = formatCatchChance(encounter.captureChance, getCatchChanceDecimals());
        if (prefix === "failed") {
          const cell = row.main.querySelector(".chance-cell");
          if (cell) cell.textContent = value;
        } else {
          const detail = row.detail?.querySelector("[data-catch-chance-detail]");
          if (detail?.lastChild) detail.lastChild.textContent = value;
        }
      }
    }
  }

  return { render, suspend, retentionSnapshot, refreshCatchChance,
    refreshLootCatalog: () => lootView.refreshCatalog() };
}
