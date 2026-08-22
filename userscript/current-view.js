import {
  RARITIES,
  formatCompact,
  formatDuration,
  formatNumber,
  formatRate,
  populateSelect,
  rarityClass,
  renderShinyCount,
  speciesLabel
} from "./ui-utils.js";
import {
  DEFAULT_ENCOUNTER_SORT,
  compareEncounters,
  formatCaptureTimestamp,
  passesEncounterFilters,
  sortEncounters
} from "./encounter-list-model.js";

const RARE_PLUS_KEYS = new Set(["rare", "epic", "legendary", "mythical"]);
const RENDER_CHUNK_SIZE = 200;

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
  const values = [ivs.hp, ivs.atk, ivs.def, ivs.spa, ivs.spd, ivs.spe];
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

function pokemonLabel(count) {
  return `${count} ${count === 1 ? "Pokémon" : "Pokémons"}`;
}

function parseFilterNumber(input) {
  if (!input.value) return null;
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
    captureResult: prefix === "captured" ? "success" : "failed",
    filters: { rarity: "*", qualityMin: null, ivMin: null, shiny: "*" },
    sort: { ...DEFAULT_ENCOUNTER_SORT },
    byId: new Map(),
    visible: [],
    rows: new Map(),
    expandedIds: new Set(),
    raritySignature: "",
    renderToken: 0,
    rendering: false
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
  const lists = {
    captured: createListState("captured"),
    failed: createListState("failed")
  };

  bindListControls("captured");
  bindListControls("failed");
  renderHudSummary({ seen: 0, seenPerHour: null });

  function bindListControls(prefix) {
    const state = lists[prefix];

    shadow.getElementById(`${prefix}-rarity`).addEventListener("change", (event) => {
      state.filters.rarity = event.target.value;
      rebuildEncounterList(prefix);
    });
    shadow.getElementById(`${prefix}-shiny`).addEventListener("change", (event) => {
      state.filters.shiny = event.target.value;
      rebuildEncounterList(prefix);
    });
    shadow.getElementById(`${prefix}-quality`).addEventListener("input", (event) => {
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
        rebuildEncounterList(prefix);
      });
    }

    updateSortIndicators(prefix);
  }

  function render({ metrics, encounters = [], sessionId = null }) {
    const sessionChanged = currentSessionId !== sessionId;
    currentSessionId = sessionId;

    renderMetrics(metrics);
    renderRarities(metrics);

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
    shadow.getElementById("profit-total").textContent = formatCompact(metrics.gold - metrics.expenses);
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
    syncRarityOptions(prefix);

    if (reset || removed || state.rendering) {
      if (reset) state.expandedIds.clear();
      rebuildEncounterList(prefix);
      return;
    }

    for (const encounter of changed) {
      upsertVisibleEncounter(prefix, encounter);
    }

    updateCount(prefix);
  }

  function syncRarityOptions(prefix) {
    const state = lists[prefix];
    const values = [...new Set(
      [...state.byId.values()].map((encounter) => encounter.quality).filter(Boolean)
    )].sort();
    const signature = values.join("|");
    if (signature === state.raritySignature) return;

    state.raritySignature = signature;
    const select = shadow.getElementById(`${prefix}-rarity`);
    populateSelect(select, values);
    state.filters.rarity = select.value;
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

  function rebuildEncounterList(prefix) {
    const state = lists[prefix];
    const body = shadow.getElementById(`${prefix}-body`);
    const token = ++state.renderToken;

    state.visible = sortEncounters(
      [...state.byId.values()].filter((encounter) => passesEncounterFilters(encounter, state.filters)),
      state.sort
    );
    state.rows.clear();
    state.rendering = state.visible.length > 0;
    body.replaceChildren();
    updateCount(prefix);

    let index = 0;
    const appendChunk = () => {
      if (token !== state.renderToken) return;

      const fragment = document.createDocumentFragment();
      const end = Math.min(index + RENDER_CHUNK_SIZE, state.visible.length);
      for (; index < end; index += 1) {
        const encounter = state.visible[index];
        const main = createEncounterRow(prefix, encounter);
        const rowState = { main, detail: null };
        state.rows.set(encounter.encounterId, rowState);
        fragment.appendChild(main);

        if (state.expandedIds.has(encounter.encounterId)) {
          const detail = createDetailRow(prefix, encounter);
          rowState.detail = detail;
          main.setAttribute("aria-expanded", "true");
          fragment.appendChild(detail);
        }
      }

      body.appendChild(fragment);

      if (index < state.visible.length) {
        scheduleFrame(appendChunk);
      } else {
        state.rendering = false;
      }
    };

    appendChunk();
  }

  function upsertVisibleEncounter(prefix, encounter) {
    const state = lists[prefix];
    const existingIndex = state.visible.findIndex((item) => item.encounterId === encounter.encounterId);
    if (existingIndex >= 0) state.visible.splice(existingIndex, 1);

    const existingRows = state.rows.get(encounter.encounterId);
    existingRows?.main.remove();
    existingRows?.detail?.remove();
    state.rows.delete(encounter.encounterId);

    if (!passesEncounterFilters(encounter, state.filters)) return;

    let low = 0;
    let high = state.visible.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (compareEncounters(encounter, state.visible[mid], state.sort) < 0) high = mid;
      else low = mid + 1;
    }

    state.visible.splice(low, 0, encounter);

    const main = createEncounterRow(prefix, encounter);
    const rowState = { main, detail: null };
    state.rows.set(encounter.encounterId, rowState);

    const next = state.visible[low + 1];
    const nextRow = next ? state.rows.get(next.encounterId)?.main : null;
    const body = shadow.getElementById(`${prefix}-body`);
    if (nextRow) body.insertBefore(main, nextRow);
    else body.appendChild(main);

    if (state.expandedIds.has(encounter.encounterId)) {
      const detail = createDetailRow(prefix, encounter);
      rowState.detail = detail;
      main.setAttribute("aria-expanded", "true");
      main.after(detail);
    }
  }

  function createEncounterRow(prefix, encounter) {
    const row = document.createElement("tr");
    row.dataset.encounterId = encounter.encounterId;
    row.tabIndex = 0;
    row.setAttribute("aria-expanded", "false");
    row.title = "Click to show encounter details";
    row.style.cursor = "pointer";
    if (encounter.isShiny) row.classList.add("encounter-row-shiny");

    const gender = genderInfo(encounter.gender);

    const pokemonCell = document.createElement("td");
    pokemonCell.className = rarityClass(encounter.quality);
    pokemonCell.textContent = `${speciesLabel(encounter)}${encounter.isShiny ? " *" : ""}`;

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

    addDetail("Timestamp", formatCaptureTimestamp(encounter.captureAtMs));
    addDetail("Capsule", encounter.capsuleName || "—");
    if (prefix === "captured") {
      addDetail("Chance", formatRate(encounter.captureChance));
    }

    cell.appendChild(content);
    row.appendChild(cell);
    return row;
  }

  function toggleEncounterDetail(prefix, encounterId) {
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
