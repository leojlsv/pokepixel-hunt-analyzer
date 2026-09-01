import {
  RARITIES,
  formatRate,
  rarityClass,
  speciesLabel
} from "./ui-utils.js";
import {
  formatCaptureTimestamp,
  formatCurrentHuntTimestamp
} from "./encounter-list-model.js";

const RARITY_LABELS = new Map(RARITIES);
const LOAD_THRESHOLD_PX = 72;

function genderLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (["male", "m", "masculino", "♂"].includes(key)) return "♂";
  if (["female", "f", "feminino", "♀"].includes(key)) return "♀";
  return "—";
}

function ivValue(value) {
  return Number.isFinite(value) ? String(value) : "—";
}

function ivTotal(encounter) {
  if (Number.isFinite(encounter?.ivTotal)) return String(encounter.ivTotal);
  const ivs = encounter?.ivs;
  if (!ivs || typeof ivs !== "object") return "—";
  const values = [ivs.hp, ivs.atk, ivs.spa, ivs.def, ivs.spd, ivs.spe];
  if (!values.some(Number.isFinite)) return "—";
  return String(values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0));
}

function qualityLabel(encounter) {
  return Number.isFinite(encounter?.qualityMultiplier)
    ? `${encounter.qualityMultiplier.toFixed(2)}x`
    : "—";
}

function rarityLabel(encounter) {
  const key = String(encounter?.quality || "").trim().toLowerCase();
  return RARITY_LABELS.get(key) || encounter?.quality || "Unknown";
}

export function buildMobileEncounterCardModel(prefix, encounter, currentHuntStartedAtMs = null) {
  const timestamp = formatCurrentHuntTimestamp(encounter?.captureAtMs, currentHuntStartedAtMs);
  const base = {
    encounterId: encounter?.encounterId,
    name: speciesLabel(encounter),
    shiny: encounter?.isShiny === true,
    rarity: rarityLabel(encounter),
    rarityClassName: rarityClass(encounter?.quality),
    ivTotal: ivTotal(encounter),
    timestamp
  };

  if (prefix === "failed") {
    return {
      ...base,
      capsule: encounter?.capsuleName || "—",
      chance: formatRate(encounter?.captureChance),
      detail: null
    };
  }

  const ivs = encounter?.ivs || {};
  return {
    ...base,
    quality: qualityLabel(encounter),
    natureGender: `${encounter?.nature || "—"} · ${genderLabel(encounter?.gender)}`,
    detail: {
      ivs: [
        ["HP", ivValue(ivs.hp)],
        ["Atk", ivValue(ivs.atk)],
        ["sAtk", ivValue(ivs.spa)],
        ["Def", ivValue(ivs.def)],
        ["sDef", ivValue(ivs.spd)],
        ["SpD", ivValue(ivs.spe)]
      ],
      capturedAt: formatCaptureTimestamp(encounter?.captureAtMs),
      capsule: encounter?.capsuleName || "—",
      chance: formatRate(encounter?.captureChance)
    }
  };
}

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function appendDetailRow(parent, label, value) {
  const row = document.createElement("div");
  row.className = "mobile-encounter-detail-row";
  row.append(
    createText("span", "mobile-encounter-detail-label", label),
    createText("strong", "mobile-encounter-detail-value", value)
  );
  parent.appendChild(row);
}

function createCapturedCard(model, expanded, onToggle) {
  const card = document.createElement("article");
  card.className = "mobile-encounter-card mobile-encounter-card-captured";
  if (model.shiny) card.classList.add("encounter-card-shiny");
  card.dataset.encounterId = model.encounterId;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", String(expanded));

  const top = document.createElement("div");
  top.className = "mobile-encounter-card-top";
  const name = createText("strong", `mobile-encounter-name ${model.rarityClassName}`.trim(), `${model.name}${model.shiny ? " ★" : ""}`);
  const iv = createText("strong", "mobile-encounter-iv", `${model.ivTotal} IV`);
  top.append(name, iv);

  const meta = document.createElement("div");
  meta.className = "mobile-encounter-card-meta";
  meta.append(
    createText("span", model.rarityClassName, model.rarity),
    createText("span", "mobile-encounter-quality", model.quality)
  );

  const footer = document.createElement("div");
  footer.className = "mobile-encounter-card-footer";
  footer.append(
    createText("span", "mobile-encounter-nature", model.natureGender),
    createText("time", "mobile-encounter-time", model.timestamp),
    createText("span", "mobile-encounter-chevron", expanded ? "▾" : "▸")
  );

  card.append(top, meta, footer);

  if (expanded && model.detail) {
    const detail = document.createElement("div");
    detail.className = "mobile-encounter-detail";
    const ivGrid = document.createElement("div");
    ivGrid.className = "mobile-encounter-iv-grid";
    for (const [label, value] of model.detail.ivs) {
      const item = document.createElement("span");
      item.append(
        createText("small", "", label),
        createText("strong", "", value)
      );
      ivGrid.appendChild(item);
    }
    detail.appendChild(ivGrid);
    appendDetailRow(detail, "Captured", model.detail.capturedAt);
    appendDetailRow(detail, "Capsule", model.detail.capsule);
    appendDetailRow(detail, "Chance", model.detail.chance);
    card.appendChild(detail);
  }

  const toggle = () => onToggle?.(model.encounterId);
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    toggle();
  });
  return card;
}

function createFailedCard(model) {
  const card = document.createElement("article");
  card.className = "mobile-encounter-card mobile-encounter-card-failed";
  if (model.shiny) card.classList.add("encounter-card-shiny");
  card.dataset.encounterId = model.encounterId;

  const top = document.createElement("div");
  top.className = "mobile-encounter-card-top";
  top.append(
    createText("strong", `mobile-encounter-name ${model.rarityClassName}`.trim(), `${model.name}${model.shiny ? " ★" : ""}`),
    createText("strong", "mobile-encounter-iv", `${model.ivTotal} IV`)
  );

  const meta = document.createElement("div");
  meta.className = "mobile-encounter-card-meta";
  meta.append(
    createText("span", model.rarityClassName, model.rarity),
    createText("span", "mobile-encounter-capsule", model.capsule)
  );

  const footer = document.createElement("div");
  footer.className = "mobile-encounter-card-footer";
  footer.append(
    createText("span", "mobile-encounter-chance", model.chance),
    createText("time", "mobile-encounter-time", `Fled ${model.timestamp}`)
  );

  card.append(top, meta, footer);
  return card;
}

function sortOptions(prefix) {
  const options = [
    ["capturedAt:desc", "Latest"],
    ["capturedAt:asc", "Oldest"],
    ["iv:desc", "IV: High → Low"],
    ["iv:asc", "IV: Low → High"]
  ];
  if (prefix === "captured") {
    options.push(
      ["quality:desc", "Quality: High → Low"],
      ["quality:asc", "Quality: Low → High"]
    );
  }
  return options;
}

function parseSort(value) {
  const [key, direction] = String(value || "capturedAt:desc").split(":");
  return {
    key: ["capturedAt", "iv", "quality"].includes(key) ? key : "capturedAt",
    direction: direction === "asc" ? "asc" : "desc"
  };
}

export function createMobileEncounterRenderer(shadow, {
  onSort,
  onNeedMore,
  onToggleCaptured
} = {}) {
  const view = shadow.getElementById("view-current");
  const contexts = new Map();

  for (const prefix of ["captured", "failed"]) {
    const section = shadow.getElementById(`${prefix}-section`);
    const filters = section?.querySelector(".filters");
    const tableWrap = section?.querySelector(".table-wrap");
    if (!section || !filters || !tableWrap) continue;

    const sortField = document.createElement("label");
    sortField.className = "mobile-sort-field";
    sortField.textContent = "Sort";
    const select = document.createElement("select");
    select.id = `${prefix}-mobile-sort`;
    for (const [value, label] of sortOptions(prefix)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.addEventListener("change", () => onSort?.(prefix, parseSort(select.value)));
    sortField.appendChild(select);
    filters.appendChild(sortField);

    const list = document.createElement("div");
    list.id = `${prefix}-mobile-list`;
    list.className = "mobile-encounter-list";
    list.setAttribute("aria-live", "polite");
    tableWrap.after(list);

    contexts.set(prefix, { list, select, cards: new Map() });
  }

  view?.addEventListener("scroll", () => {
    const viewRect = view.getBoundingClientRect();
    for (const [prefix, context] of contexts) {
      if (!context.list.getClientRects().length) continue;
      const listRect = context.list.getBoundingClientRect();
      if (listRect.bottom - viewRect.bottom <= LOAD_THRESHOLD_PX) onNeedMore?.(prefix);
    }
  }, { passive: true });

  function syncSort(prefix, sort) {
    const context = contexts.get(prefix);
    if (!context) return;
    const value = `${sort?.key || "capturedAt"}:${sort?.direction === "asc" ? "asc" : "desc"}`;
    if ([...context.select.options].some((option) => option.value === value)) {
      context.select.value = value;
    }
  }

  function render(prefix, encounters, {
    expandedIds = new Set(),
    currentHuntStartedAtMs = null,
    sort = null
  } = {}) {
    const context = contexts.get(prefix);
    if (!context) return;
    syncSort(prefix, sort);

    const desiredIds = new Set(encounters.map((encounter) => encounter.encounterId));
    for (const [encounterId, cardState] of context.cards) {
      if (desiredIds.has(encounterId)) continue;
      cardState.element.remove();
      context.cards.delete(encounterId);
    }

    encounters.forEach((encounter, index) => {
      const model = buildMobileEncounterCardModel(prefix, encounter, currentHuntStartedAtMs);
      const expanded = prefix === "captured" && expandedIds.has(encounter.encounterId);
      const signature = JSON.stringify([model, expanded]);
      let cardState = context.cards.get(encounter.encounterId);

      if (!cardState || cardState.signature !== signature) {
        const element = prefix === "captured"
          ? createCapturedCard(model, expanded, onToggleCaptured)
          : createFailedCard(model);
        if (cardState) cardState.element.replaceWith(element);
        cardState = { element, signature };
        context.cards.set(encounter.encounterId, cardState);
      }

      const currentAtIndex = context.list.children[index];
      if (currentAtIndex !== cardState.element) {
        context.list.insertBefore(cardState.element, currentAtIndex || null);
      }
    });
  }

  return { render, syncSort };
}
