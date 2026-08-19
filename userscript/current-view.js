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

const RARE_PLUS_KEYS = new Set(["rare", "epic", "legendary", "mythical"]);

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

function passesFilters(encounter, filters) {
  if (filters.rarity !== "*" && encounter.quality !== filters.rarity) return false;
  if (filters.qualityMin != null && !(
    Number.isFinite(encounter.qualityMultiplier) &&
    encounter.qualityMultiplier > filters.qualityMin
  )) return false;
  if (filters.ivMin != null && !(
    Number.isFinite(encounter.ivTotal) && encounter.ivTotal > filters.ivMin
  )) return false;
  return true;
}

function createEncounterRow(encounter) {
  const row = document.createElement("tr");
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
  return row;
}

export function createCurrentView(shadow) {
  let encounters = [];
  const filtersByResult = {
    captured: { rarity: "*", qualityMin: null, ivMin: null },
    failed: { rarity: "*", qualityMin: null, ivMin: null }
  };

  bindFilters("captured");
  bindFilters("failed");
  renderHudSummary({ seen: 0, seenPerHour: null });

  function bindFilters(prefix) {
    const filters = filtersByResult[prefix];
    shadow.getElementById(`${prefix}-rarity`).addEventListener("change", (event) => {
      filters.rarity = event.target.value;
      renderEncounterList(prefix);
    });
    shadow.getElementById(`${prefix}-quality`).addEventListener("input", (event) => {
      filters.qualityMin = parseFilterNumber(event.target);
      renderEncounterList(prefix);
    });
    shadow.getElementById(`${prefix}-iv`).addEventListener("input", (event) => {
      filters.ivMin = parseFilterNumber(event.target);
      renderEncounterList(prefix);
    });
  }

  function render({ metrics, encounters: nextEncounters }) {
    encounters = nextEncounters;
    renderMetrics(metrics);
    renderRarities(metrics);
    renderEncounterList("captured");
    renderEncounterList("failed");
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
      row.querySelector('[data-field="seen"]').textContent = rarity.shinySeen
        ? `${formatNumber(rarity.seen)} (${formatNumber(rarity.shinySeen)})`
        : formatNumber(rarity.seen);
      row.querySelector('[data-field="captured"]').textContent = rarity.shinyCaptured
        ? `${formatNumber(rarity.captured)} (${formatNumber(rarity.shinyCaptured)})`
        : formatNumber(rarity.captured);
      row.querySelector('[data-field="failed"]').textContent = rarity.shinyFailed
        ? `${formatNumber(rarity.failed)} (${formatNumber(rarity.shinyFailed)})`
        : formatNumber(rarity.failed);
      row.querySelector('[data-field="rate"]').textContent = formatRate(
        rarity.seen ? rarity.captured / rarity.seen : null
      );

      shadow.getElementById(`hud-${key}`).textContent = String(rarity.captured || 0);
      if (RARE_PLUS_KEYS.has(key)) rarePlusFailed += rarity.failed || 0;
    }

    shadow.getElementById("rare-failed-count").textContent = `R+ fail ${rarePlusFailed}`;
  }

  function renderEncounterList(prefix) {
    const captureResult = prefix === "captured" ? "success" : "failed";
    const matching = encounters.filter((encounter) => encounter.captureResult === captureResult);
    const select = shadow.getElementById(`${prefix}-rarity`);
    populateSelect(
      select,
      [...new Set(matching.map((encounter) => encounter.quality).filter(Boolean))].sort()
    );

    const filters = filtersByResult[prefix];
    filters.rarity = select.value;

    const fragment = document.createDocumentFragment();
    let visibleCount = 0;
    for (const encounter of matching) {
      if (!passesFilters(encounter, filters)) continue;
      fragment.appendChild(createEncounterRow(encounter));
      visibleCount += 1;
    }

    shadow.getElementById(`${prefix}-body`).replaceChildren(fragment);
    shadow.getElementById(`${prefix}-count`).textContent = pokemonLabel(visibleCount);
  }

  return { render };
}
