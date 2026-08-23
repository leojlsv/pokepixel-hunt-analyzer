import { computeGroupMetrics } from "../domain/groupMetrics.js";
import { computeRarityBreakdown } from "../domain/rarityBreakdown.js";
import { computeSessionMetrics } from "../domain/sessionMetrics.js";
import {
  NOTABLE_RARITIES,
  notableEncounters
} from "./hunt-view-model.js";
import {
  RARITIES,
  formatCompact,
  formatDuration,
  formatNumber,
  formatRate,
  populateSelect,
  rarityClass,
  speciesLabel
} from "./ui-utils.js";

const HISTORY_SESSION_LIMIT = 20;
const ATTEMPT_BATCH_SIZE = 100;

const RARITY_SHORT = new Map([
  ["weak", "Wk"],
  ["common", "Com"],
  ["uncommon", "Unc"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Leg"],
  ["mythical", "Myt"]
]);

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

export function createHistoryView(shadow, { loadSessions, loadSessionEncounters }) {
  let bundles = [];
  let activeSubview = "hunts";
  let attemptRenderCount = ATTEMPT_BATCH_SIZE;
  let loading = false;
  const expandedHunts = new Set();
  const expandedAttempts = new Set();
  const expandedPokemon = new Set();
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

  bindControls();

  function bindControls() {
    for (const button of shadow.querySelectorAll("[data-history-view]")) {
      button.addEventListener("click", () => {
        activeSubview = button.dataset.historyView;
        attemptRenderCount = ATTEMPT_BATCH_SIZE;
        for (const candidate of shadow.querySelectorAll("[data-history-view]")) {
          candidate.classList.toggle("active", candidate === button);
        }
        render();
      });
    }

    shadow.getElementById("history-period").addEventListener("change", async (event) => {
      filters.period = event.target.value;
      await refresh();
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

  async function refresh() {
    if (loading) return;
    loading = true;
    setStatus("Loading…");

    try {
      const range = periodRange(filters.period);
      const sessions = await loadSessions({ limit: HISTORY_SESSION_LIMIT, ...range });
      const loaded = [];

      for (const session of sessions) {
        const encounters = await loadSessionEncounters(session.sessionId);
        loaded.push({
          session,
          encounters,
          metrics: computeSessionMetrics({ session, encounters, now: Date.now() })
        });
      }

      bundles = loaded;
      expandedHunts.clear();
      expandedAttempts.clear();
      expandedPokemon.clear();
      notableSelectionBySession.clear();
      attemptRenderCount = ATTEMPT_BATCH_SIZE;
      populateFilters();
      render();
    } finally {
      loading = false;
    }
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

  function render() {
    for (const section of shadow.querySelectorAll("[data-history-panel]")) {
      section.hidden = section.dataset.historyPanel !== activeSubview;
    }

    if (activeSubview === "pokemon") renderPokemon();
    else if (activeSubview === "attempts") renderAttempts();
    else renderHunts();
  }

  function setStatus(text) {
    shadow.getElementById("history-count").textContent = text;
  }

  function renderHunts() {
    const rows = visibleBundles();
    setStatus(`${rows.length} ${rows.length === 1 ? "Hunt" : "Hunts"}`);
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
        formatDuration(bundle.metrics.activeMs),
        formatNumber(breakdown.seen),
        formatNumber(breakdown.captured),
        formatNumber(breakdown.shiny.failed),
        formatNumber(breakdown.rarities.legendary.failed),
        formatNumber(breakdown.rarities.mythical.failed)
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
        renderHunts();
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
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["At", "Pokémon", "Result", "Qlt", "IV"].forEach((label) => {
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
        Number.isFinite(encounter.qualityMultiplier) ? encounter.qualityMultiplier.toFixed(2) : "—",
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
        renderPokemon();
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
      const values = [
        RARITY_SHORT.get(key),
        formatNumber(metric.seen),
        formatNumber(metric.captured),
        formatNumber(metric.failed),
        formatRate(metric.seen ? metric.captured / metric.seen : null)
      ];
      values.forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = value;
        if (index === 0) td.className = rarityClass(key);
        row.appendChild(td);
      });
      body.appendChild(row);
    }

    table.append(head, body);
    cell.appendChild(table);
    detailRow.appendChild(cell);
    return detailRow;
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
      row.tabIndex = 0;
      row.setAttribute("aria-expanded", String(expandedAttempts.has(encounter.encounterId)));
      const result = encounter.captureResult === "success" ? "Cap." : "Fled";
      const values = [
        formatAttemptTime(encounter.captureAtMs),
        `${speciesLabel(encounter)}${encounter.isShiny ? " *" : ""}`,
        RARITY_SHORT.get(encounter.quality) || "—",
        result,
        Number.isFinite(encounter.qualityMultiplier) ? encounter.qualityMultiplier.toFixed(2) : "—",
        ivTotal(encounter) ?? "—"
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 2) cell.className = rarityClass(encounter.quality);
        row.appendChild(cell);
      });

      const toggle = () => {
        if (expandedAttempts.has(encounter.encounterId)) expandedAttempts.delete(encounter.encounterId);
        else expandedAttempts.add(encounter.encounterId);
        renderAttempts();
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
          `Capsule: ${encounter.capsuleName || "—"}`
        ];
        if (encounter.captureResult === "success") {
          parts.push(`Chance: ${formatRate(encounter.captureChance)}`);
        }
        detailCell.textContent = parts.join(" · ");
        detailRow.appendChild(detailCell);
        fragment.appendChild(detailRow);
      }
    }

    body.replaceChildren(fragment);
  }

  return { refresh };
}
