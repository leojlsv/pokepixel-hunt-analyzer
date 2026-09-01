import {
  RARITIES,
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

const RARE_PLUS_KEYS = new Set(["rare", "epic", "legendary", "mythical"]);
const RARITY_LABELS = new Map(RARITIES);
const LIST_RENDER_BATCH = 100;
const LIST_LOAD_THRESHOLD_PX = 48;

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

function ivDisplay(encounter) {
  const values = ivValues(encounter.ivs);
  if (!values) return "—";

  const breakdown = values
    .map((value) => (Number.isFinite(value) ? value : "—"))
    .join("-");
  const total = Number.isFinite(encounter.ivTotal)
    ? encounter.ivTotal
    : values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

  return `${total} (${breakdown})`;
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
  return {
    prefix,
    // `null` means All (*), including an unexpected future/unknown rarity.
    filters: { rarities: null, qualityMin: null, ivMin: null, shiny: "*" },
    sort: { ...DEFAULT_ENCOUNTER_SORT },
    byId: new Map(),
    visible: [],
    rows: new Map(),
    expandedIds: new Set(),
    renderToken: 0,
    rendering: false,
    renderedCount: 0
  };
}

function encounterChanged(previous, next) {
  if (!previous) return true;
  return previous.updatedAtMs !== next.updatedAtMs ||
    previous.captureAtMs !== next.captureAtMs ||
    previous.qualityMultiplier !== next.qualityMultiplier ||
    previous.ivTotal !== next.ivTotal ||
    previous.isShiny !== next.isShiny ||
    previous.capsuleName !== next.capsuleName ||
    previous.captureChance !== next.captureChance ||
    previous.speciesName !== next.speciesName ||
    previous.gender !== next.gender ||
    previous.nature !== next.nature;
}

export function createCurrentView(shadow) {
  let currentSessionId;
  let currentHuntStartedAtMs = null;
  let lastEncounterSnapshotVersion = -1;
  const lists = {
    captured: createListState("captured"),
    failed: createListState("failed")
  };

  bindListControls("captured");
  bindListControls("failed");
  renderHudSummary({ seen: 0, seenPerHour: null });

  function bindRarityFilter(prefix, state) {
    const root = shadow.getElementById(`${prefix}-rarity`);
    const all = root.querySelector("[data-rarity-all]");
    const options = [...root.querySelectorAll("[data-rarity-value]")];
    const label = shadow.getElementById(`${prefix}-rarity-label`);

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
      header.addEventListener("click", () => {
        const key = header.dataset.sortKey;
        if (state.sort.key === key) {
          state.sort.direction = state.sort.direction === "desc" ? "asc" : "desc";
        } else {
          state.sort = { key, direction: "desc" };
        }
        updateSortIndicators(prefix);
        rebuildEncounterList(prefix, { resetScroll: false });
      });
    }

    const tableWrap = shadow.getElementById(`${prefix}-body`).closest(".table-wrap");
    tableWrap?.addEventListener("scroll", () => {
      if (state.rendering || state.renderedCount >= state.visible.length) return;
      const remaining = tableWrap.scrollHeight - tableWrap.scrollTop - tableWrap.clientHeight;
      if (remaining <= LIST_LOAD_THRESHOLD_PX) appendEncounterBatch(prefix);
    }, { passive: true });

    updateSortIndicators(prefix);
  }

  function render({
    metrics,
    encounters = [],
    sessionId = null,
    encounterSnapshotVersion = 0
  }) {
    const sessionChanged = currentSessionId !== sessionId;
    const encounterSnapshotChanged =
      sessionChanged || lastEncounterSnapshotVersion !== encounterSnapshotVersion;
    currentSessionId = sessionId;
    currentHuntStartedAtMs = Number.isFinite(metrics?.startedAtMs) ? metrics.startedAtMs : null;
    lastEncounterSnapshotVersion = encounterSnapshotVersion;

    renderMetrics(metrics);
    renderRarities(metrics);

    if (!encounterSnapshotChanged) return;

    const latestTarget = latestSpeciesEncounter(encounters);
    shadow.querySelector(".status-row > span").textContent = latestTarget
      ? speciesLabel(latestTarget)
      : "Hunt";

    const grouped = { captured: [], failed: [] };
    for (const encounter of encounters) {
      if (encounter.captureResult === "success") grouped.captured.push(encounter);
      else if (encounter.captureResult === "failed") grouped.failed.push(encounter);
    }

    syncEncounterData("captured", grouped.captured, sessionChanged);
    syncEncounterData("failed", grouped.failed, sessionChanged);
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
      if (RARE_PLUS_KEYS.has(key)) rarePlusFailed += rarity.failed || 0;
    }

    shadow.getElementById("rare-failed-count").textContent = `R+ fail ${rarePlusFailed}`;
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
      if (!indicator) continue;
      indicator.textContent = header.dataset.sortKey === state.sort.key
        ? state.sort.direction === "desc" ? "▼" : "▲"
        : "";
    }
  }

  function rebuildEncounterList(prefix, { resetScroll = true } = {}) {
    const state = lists[prefix];
    const body = shadow.getElementById(`${prefix}-body`);
    const tableWrap = body.closest(".table-wrap");
    const previousScrollTop = tableWrap?.scrollTop || 0;
    const previousRenderedCount = state.renderedCount;
    state.renderToken += 1;

    state.visible = sortEncounters(
      [...state.byId.values()].filter((encounter) => passesEncounterFilters(encounter, state.filters)),
      state.sort
    );
    state.rows.clear();
    state.rendering = false;
    state.renderedCount = 0;
    body.replaceChildren();
    if (resetScroll && tableWrap) tableWrap.scrollTop = 0;
    updateCount(prefix);

    const targetCount = resetScroll
      ? LIST_RENDER_BATCH
      : Math.max(LIST_RENDER_BATCH, previousRenderedCount);
    appendEncounterBatch(prefix, {
      targetCount,
      restoreScrollTop: resetScroll ? null : previousScrollTop
    });
  }

  function appendEncounterBatch(prefix, { targetCount = null, restoreScrollTop = null } = {}) {
    const state = lists[prefix];
    if (state.rendering || state.renderedCount >= state.visible.length) return;

    const token = state.renderToken;
    state.rendering = true;
    scheduleFrame(() => {
      if (token !== state.renderToken) return;

      const body = shadow.getElementById(`${prefix}-body`);
      const tableWrap = body.closest(".table-wrap");
      const fragment = document.createDocumentFragment();
      const start = state.renderedCount;
      const end = Math.min(start + LIST_RENDER_BATCH, state.visible.length);

      for (let index = start; index < end; index += 1) {
        const encounter = state.visible[index];
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

      body.appendChild(fragment);
      state.renderedCount = end;
      state.rendering = false;

      const requestedTarget = Number.isFinite(targetCount)
        ? Math.min(targetCount, state.visible.length)
        : null;
      if (requestedTarget != null && state.renderedCount < requestedTarget) {
        appendEncounterBatch(prefix, { targetCount, restoreScrollTop });
        return;
      }

      if (restoreScrollTop != null && tableWrap) {
        tableWrap.scrollTop = Math.min(
          restoreScrollTop,
          Math.max(0, tableWrap.scrollHeight - tableWrap.clientHeight)
        );
      }
    });
  }

  function upsertVisibleEncounter(prefix, encounter) {
    const state = lists[prefix];
    const existingIndex = state.visible.findIndex((item) => item.encounterId === encounter.encounterId);

    if (existingIndex >= 0) {
      rebuildEncounterList(prefix, { resetScroll: false });
      return;
    }

    if (!passesEncounterFilters(encounter, state.filters)) return;

    const previousVisibleCount = state.visible.length;
    const previousRenderedCount = state.renderedCount;
    const hadRenderedAll = previousRenderedCount >= previousVisibleCount;

    let low = 0;
    let high = state.visible.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (compareEncounters(encounter, state.visible[mid], state.sort) < 0) high = mid;
      else low = mid + 1;
    }

    state.visible.splice(low, 0, encounter);
    const desiredRenderedCount = hadRenderedAll
      ? Math.min(previousRenderedCount + 1, state.visible.length)
      : previousRenderedCount;

    if (low >= desiredRenderedCount) {
      state.renderedCount = desiredRenderedCount;
      return;
    }

    const body = shadow.getElementById(`${prefix}-body`);
    const main = createEncounterRow(prefix, encounter);
    const rowState = { main, detail: null };
    state.rows.set(encounter.encounterId, rowState);

    let nextRow = null;
    for (let index = low + 1; index < desiredRenderedCount; index += 1) {
      nextRow = state.rows.get(state.visible[index].encounterId)?.main || null;
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

    const overflowEncounter = state.visible[desiredRenderedCount];
    if (overflowEncounter) {
      const overflowRows = state.rows.get(overflowEncounter.encounterId);
      overflowRows?.detail?.remove();
      overflowRows?.main.remove();
      state.rows.delete(overflowEncounter.encounterId);
    }

    state.renderedCount = desiredRenderedCount;
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
      chanceCell.textContent = formatRate(encounter.captureChance);

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
    ivCell.textContent = ivDisplay(encounter);

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
    };

    addDetail(
      prefix === "captured" ? "Captured at" : "Fled at",
      formatCaptureTimestamp(encounter.captureAtMs)
    );
    addDetail("Capsule", encounter.capsuleName || "—");
    if (prefix === "captured") {
      addDetail("Chance", formatRate(encounter.captureChance));
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

  return { render };
}