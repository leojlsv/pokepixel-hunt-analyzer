import { computeGroupMetrics } from "../domain/groupMetrics.js";
import { computeRarityBreakdown } from "../domain/rarityBreakdown.js";
import {
  RARITIES,
  RARITY_ORDER,
  formatNumber,
  formatRate,
  populateSelect,
  renderShinyCount,
  speciesLabel
} from "./ui-utils.js";

const DEFAULT_SORT = {
  cycle: { column: 5, direction: "desc" },
  rarity: { column: 1, direction: "desc" }
};

function distinct(encounters, key) {
  return [...new Set(encounters.map((encounter) => encounter[key]).filter(Boolean))].sort();
}

function distinctElements(encounters) {
  return [...new Set(encounters.flatMap((encounter) =>
    Array.isArray(encounter.elements) ? encounter.elements : []
  ))].sort();
}

function compareValues(left, right) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export function createCompareView(shadow, loadEncounters) {
  let encounters = [];
  const filters = {
    species: "*",
    capsule: "*",
    element: "*",
    theme: "cycle"
  };
  let sort = { ...DEFAULT_SORT.cycle };

  bindFilters();

  function bindFilters() {
    shadow.getElementById("compare-theme").addEventListener("change", (event) => {
      filters.theme = event.target.value;
      sort = { ...DEFAULT_SORT[filters.theme] };
      render();
    });
    shadow.getElementById("compare-species").addEventListener("change", (event) => {
      filters.species = event.target.value;
      render();
    });
    shadow.getElementById("compare-capsule").addEventListener("change", (event) => {
      filters.capsule = event.target.value;
      render();
    });
    shadow.getElementById("compare-element").addEventListener("change", (event) => {
      filters.element = event.target.value;
      render();
    });
  }

  async function refresh() {
    encounters = await loadEncounters();
    populateFilters();
    render();
  }

  function populateFilters() {
    const species = new Map();
    for (const encounter of encounters) {
      if (encounter.speciesId && !species.has(encounter.speciesId)) {
        species.set(encounter.speciesId, speciesLabel(encounter));
      }
    }

    populateSelect(
      shadow.getElementById("compare-species"),
      [...species.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      ([id, label]) => [id, label]
    );
    populateSelect(
      shadow.getElementById("compare-capsule"),
      distinct(encounters, "capsuleName")
    );
    populateSelect(
      shadow.getElementById("compare-element"),
      distinctElements(encounters)
    );

    filters.species = shadow.getElementById("compare-species").value;
    filters.capsule = shadow.getElementById("compare-capsule").value;
    filters.element = shadow.getElementById("compare-element").value;
  }

  function filteredEncounters() {
    return encounters.filter((encounter) =>
      (filters.species === "*" || encounter.speciesId === filters.species) &&
      (filters.capsule === "*" || encounter.capsuleName === filters.capsule) &&
      (filters.element === "*" || (
        Array.isArray(encounter.elements) && encounter.elements.includes(filters.element)
      ))
    );
  }

  function render() {
    if (filters.theme === "rarity") renderRarity();
    else renderCycle();
  }

  function renderRarity() {
    const breakdown = computeRarityBreakdown(filteredEncounters());
    const rows = RARITIES.map(([key, label]) => {
      const metric = breakdown.rarities[key];
      const captureRate = metric.seen ? metric.captured / metric.seen : null;
      return {
        sort: [
          RARITY_ORDER.get(key),
          metric.seen,
          metric.captured,
          metric.failed,
          captureRate ?? Number.NEGATIVE_INFINITY
        ],
        cells: [
          label,
          formatNumber(metric.seen),
          formatNumber(metric.captured),
          formatNumber(metric.failed),
          formatRate(captureRate)
        ],
        shinyCounts: {
          1: [metric.seen, metric.shinySeen],
          2: [metric.captured, metric.shinyCaptured],
          3: [metric.failed, metric.shinyFailed]
        },
        rarity: key
      };
    });
    renderRows(["Rarity", "Seen", "Cap.", "Fail", "Rate"], rows);
  }

  function renderCycle() {
    const groups = new Map();
    for (const encounter of filteredEncounters()) {
      if (!encounter.groupKey) continue;
      if (!groups.has(encounter.groupKey)) {
        groups.set(encounter.groupKey, { sample: encounter, encounters: [] });
      }
      groups.get(encounter.groupKey).encounters.push(encounter);
    }

    const rows = [...groups.values()].map(({ sample, encounters: groupEncounters }) => {
      const metric = computeGroupMetrics(groupEncounters);
      const name = speciesLabel(sample);
      const level = Number.isFinite(sample.level) ? sample.level : Number.NEGATIVE_INFINITY;
      return {
        sort: [
          name.toLocaleLowerCase(),
          level,
          metric.seen,
          metric.captured,
          metric.failed,
          metric.trainerExpPerCycleHour ?? Number.NEGATIVE_INFINITY,
          metric.dollarPerCycleHour ?? Number.NEGATIVE_INFINITY
        ],
        cells: [
          name,
          sample.level ?? "—",
          formatNumber(metric.seen),
          formatNumber(metric.captured),
          formatNumber(metric.failed),
          metric.trainerExpPerCycleHour == null
            ? "—" : formatNumber(metric.trainerExpPerCycleHour),
          metric.dollarPerCycleHour == null
            ? "—" : formatNumber(metric.dollarPerCycleHour)
        ]
      };
    });
    renderRows(["Pokémon", "Lvl", "Seen", "Cap.", "Fail", "EXP/Cycle h", "$/Cycle h"], rows);
  }

  function renderRows(headers, rows) {
    const direction = sort.direction === "asc" ? 1 : -1;
    rows.sort((left, right) => {
      const primary = compareValues(left.sort[sort.column], right.sort[sort.column]);
      if (primary !== 0) return primary * direction;
      return compareValues(left.sort[0], right.sort[0]);
    });

    const head = shadow.getElementById("compare-head");
    head.replaceChildren();
    headers.forEach((label, column) => {
      const cell = document.createElement("th");
      cell.textContent = label;
      cell.classList.add("sortable");
      if (sort.column === column) {
        cell.classList.add(sort.direction === "asc" ? "sort-asc" : "sort-desc");
      }
      cell.addEventListener("click", () => {
        sort = sort.column === column
          ? { column, direction: sort.direction === "desc" ? "asc" : "desc" }
          : { column, direction: "desc" };
        render();
      });
      head.appendChild(cell);
    });

    const fragment = document.createDocumentFragment();
    for (const rowData of rows) {
      const row = document.createElement("tr");
      rowData.cells.forEach((value, index) => {
        const cell = document.createElement("td");
        const shinyCount = rowData.shinyCounts?.[index];
        if (shinyCount) renderShinyCount(cell, shinyCount[0], shinyCount[1]);
        else cell.textContent = value;
        if (index === 0 && rowData.rarity) cell.className = `rarity-${rowData.rarity}`;
        row.appendChild(cell);
      });
      fragment.appendChild(row);
    }
    shadow.getElementById("compare-body").replaceChildren(fragment);
  }

  return { refresh };
}
