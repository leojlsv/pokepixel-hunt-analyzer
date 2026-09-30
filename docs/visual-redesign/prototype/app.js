/*
 * Offline prototype only. This file changes local preview navigation and
 * filters synthetic table rows; it never reads application or game state.
 */
(() => {
  "use strict";

  const VIEWPORTS = Object.freeze({
    "desktop-415": { mode: "desktop", width: 415, height: 700, caption: "DESKTOP / COMPACT" },
    "desktop-620": { mode: "desktop", width: 620, height: 700, caption: "DESKTOP / STANDARD" },
    "mobile-320": { mode: "mobile", width: 320, height: 568, caption: "MOBILE / SMALL" },
    "mobile-390": { mode: "mobile", width: 390, height: 844, caption: "MOBILE / STANDARD" }
  });
  const SCREENS = ["current", "history", "misc", "hud"];
  const HISTORY_SCREENS = ["hunts", "pokemon", "attempts"];
  // IDs, row boundaries, and the wide Rarity Tracker follow
  // CLOSED_HUD_PRESETS in userscript/closed-hud.js:131-156.
  // Numeric examples are synthetic and intentionally local to this mock.
  const HUD_PRESETS = Object.freeze({
    default: [
      { widget: "seen", name: "Seen", label: "Seen", value: "16,842" },
      { widget: "seenPerHour", name: "Seen/h", label: "Seen/h", value: "915" },
      { widget: "rarityTracker", name: "Rarity Tracker", size: 2 },
      { widget: "empty", name: "Empty" }
    ],
    leveling: [
      { widget: "trainerXpPerHour", name: "Trainer XP/h", label: "XP/h", value: "18.4K" },
      { widget: "pokemonXpPerHour", name: "Pokémon XP/h", label: "PK XP/h", value: "94.2K" },
      { widget: "seen", name: "Seen", label: "Seen", value: "16,842" },
      { widget: "seenPerHour", name: "Seen/h", label: "Seen/h", value: "915" }
    ],
    economy: [
      { widget: "dollarPerHour", name: "Dollar/h", label: "$/h", value: "98.9K" },
      { widget: "profitPerHour", name: "Profit/h", label: "Profit/h", value: "+97.9K", tone: "positive" },
      { widget: "expenses", name: "Expenses", label: "Expenses", value: "18.3K" },
      { widget: "huntTime", name: "Hunt Time", label: "Time", value: "18:24:12" }
    ],
    capture: [
      { widget: "seen", name: "Seen", label: "Seen", value: "16,842" },
      { widget: "captured", name: "Captured", label: "Cap", value: "1,409" },
      { widget: "failed", name: "Failed", label: "Fail", value: "15,433" },
      { widget: "captureRate", name: "Capture Rate", label: "Capture", value: "8.37%" }
    ]
  });

  const prototype = document.getElementById("prototype");
  const scrollRoot = document.getElementById("content-scroll");
  const screenSelect = document.getElementById("screen-select");
  const viewportButtons = [...document.querySelectorAll("[data-viewport].viewport-option")];
  const appTabs = [...prototype.querySelectorAll(".app-tab[data-screen]")];
  const historyTabs = [...prototype.querySelectorAll(".history-tab[data-history]")];
  const currentRoute = document.getElementById("current-route");
  const dimensionLabel = document.getElementById("dimension-label");
  const previewCaption = document.getElementById("preview-caption");
  const tables = [...prototype.querySelectorAll(".data-table")];
  const tableState = new Map();
  const sortCollator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  const SHORT_HEADERS = Object.freeze({
    Gender: "G", Nature: "Nature", Quality: "Qlt", "IV Total": "Total",
    "HP IV": "HP", "Atk IV": "Atk", "sAtk IV": "sAtk",
    "Def IV": "Def", "sDef IV": "sDef", "SpD IV": "SpD",
    "Pokéball": "Ball", "Fled at": "Time",
    Captured: "Cap.", "Capture Rate": "Rate",
    "XP/Cyc": "XP/Cyc", "$/Cyc": "$/Cyc"
  });

  function sortValue(rawValue) {
    const raw = rawValue.replace(/⌄/g, "").replace(/\s+/g, " ").trim();
    if (raw === "" || raw === "—") return { type: "missing", value: null };
    const date = raw.match(/^(\d{2})\/(\d{2})(?:\s*[· ]\s*(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (date) return {
      type: "number",
      value: ((((Number(date[2]) * 32 + Number(date[1])) * 24 + Number(date[3] || 0)) *
        60 + Number(date[4] || 0)) * 60) + Number(date[5] || 0)
    };
    const time = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (time) return {
      type: "number",
      value: Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3] || 0)
    };
    const numeric = raw.match(/^[+×]?(-?[\d,.]+)([KMB])?%?$/i);
    if (numeric) {
      const quantity = numeric[1].includes(".") ? Number(numeric[1].replaceAll(",", "")) :
        Number(numeric[1].replaceAll(",", ""));
      const multiple = { K: 1e3, M: 1e6, B: 1e9 }[numeric[2]?.toUpperCase()] || 1;
      return { type: "number", value: quantity * multiple };
    }
    return { type: "text", value: raw };
  }

  function compareCells(a, b) {
    if (a.type === "missing") return b.type === "missing" ? 0 : 1;
    if (b.type === "missing") return -1;
    if (a.type === "number" && b.type === "number") return a.value - b.value;
    return sortCollator.compare(String(a.value), String(b.value));
  }

  function updateSortState(table) {
    const state = tableState.get(table);
    if (!state) return;
    for (const [index, th] of state.headers.entries()) {
      const selected = index === state.column;
      th.setAttribute("aria-sort", selected ? state.direction : "none");
      const arrow = th.querySelector(".sort-direction");
      if (arrow) arrow.textContent = selected ? state.direction === "ascending" ? "↑" : "↓" : "↕";
      th.querySelector(".sort-header-button")?.setAttribute(
        "aria-label", "Ordenar por " + state.labels[index] +
        (selected ? " — " + state.direction : "")
      );
    }
    state.select.value = state.column === null ? "" : String(state.column);
    state.toolbarSummary.textContent = state.column === null
      ? "Sort · original order"
      : "Sort · " + state.labels[state.column] + " " +
        (state.direction === "ascending" ? "↑" : "↓");
    state.directionButton.disabled = state.column === null;
    state.directionButton.textContent = state.direction === "ascending" ? "↑ Asc" : "↓ Desc";
    state.directionButton.setAttribute(
      "aria-label", "Ordem " + (state.direction === "ascending" ? "crescente" : "decrescente") +
      "; toque para inverter"
    );
  }

  function sortTable(table, column, direction = null) {
    const state = tableState.get(table);
    if (!state || !state.headers[column] || !state.sortableColumns.includes(column)) return;
    state.direction = direction || (state.column === column
      ? state.direction === "ascending" ? "descending" : "ascending"
      : "ascending");
    state.column = column;
    const tbody = table.querySelector("tbody");
    const primaryRows = [...tbody.children].filter((row) => !row.classList.contains("history-detail"));
    const groups = primaryRows.map((row, index) => {
      const detailTarget = row.querySelector(".history-detail-toggle")?.getAttribute("aria-controls");
      const detailRow = detailTarget && tbody.querySelector('[id="' + detailTarget + '"]');
      return {
        row,
        detailRow,
        index,
        key: sortValue(column === 0 && row.querySelector(".record-detail-name")
          ? row.querySelector(".record-detail-name").textContent
          : row.children[column]?.textContent || "")
      };
    });
    const sign = state.direction === "ascending" ? 1 : -1;
    groups.sort((first, second) => sign * compareCells(first.key, second.key) || first.index - second.index);
    const fragment = document.createDocumentFragment();
    for (const group of groups) {
      fragment.appendChild(group.row);
      if (group.detailRow) fragment.appendChild(group.detailRow);
    }
    tbody.appendChild(fragment);
    updateSortState(table);
  }

  function enhanceTable(table) {
    const headers = [...table.querySelectorAll("thead tr th")];
    if (!headers.length) return;
    // Real HTML <table>, scope="row"/"col", and explicit roles survive
    // display:grid in responsive mode (especially Chromium accessibility).
    table.setAttribute("role", "table");
    table.querySelector("thead").setAttribute("role", "rowgroup");
    table.querySelector("tbody").setAttribute("role", "rowgroup");
    for (const row of table.querySelectorAll("tr")) {
      row.setAttribute("role", "row");
      const detail = row.classList.contains("history-detail");
      for (const [index, cell] of [...row.children].entries()) {
        cell.setAttribute("role", cell.tagName === "TH"
          ? cell.getAttribute("scope") === "row" ? "rowheader" : "columnheader"
          : "cell");
        if (!detail && cell.tagName === "TD") {
          cell.dataset.label = headers[index]?.textContent.trim() || "";
        }
      }
    }
    const labels = headers.map((th) => th.textContent.trim());
    const sortableColumns = labels.flatMap((label, index) => label === "Actions" ? [] : [index]);
    const toolbar = document.createElement("details");
    toolbar.className = "table-sort-toolbar";
    const toolbarSummary = document.createElement("summary");
    toolbarSummary.textContent = "Sort · original order";
    const toolbarControls = document.createElement("div");
    toolbarControls.className = "table-sort-controls";
    const sortLabel = document.createElement("label");
    sortLabel.textContent = "Sort by";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Ordenar tabela " + table.getAttribute("aria-label") + " por");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select column";
    select.appendChild(placeholder);
    for (const index of sortableColumns) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = labels[index];
      select.appendChild(option);
    }
    sortLabel.appendChild(select);
    const directionButton = document.createElement("button");
    directionButton.type = "button";
    directionButton.className = "sort-order-button";
    toolbarControls.append(sortLabel, directionButton);
    toolbar.append(toolbarSummary, toolbarControls);
    table.parentElement.before(toolbar);
    tableState.set(table, {
      headers, labels, sortableColumns, toolbar, toolbarSummary, select, directionButton, column: null, direction: "ascending"
    });

    for (const index of sortableColumns) {
      const th = headers[index];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sort-header-button";
      const title = document.createElement("span");
      title.textContent = labels[index];
      title.dataset.shortLabel = SHORT_HEADERS[labels[index]] || labels[index];
      const arrow = document.createElement("span");
      arrow.className = "sort-direction";
      arrow.setAttribute("aria-hidden", "true");
      button.append(title, arrow);
      th.replaceChildren(button);
      button.addEventListener("click", () => sortTable(table, index));
    }
    select.addEventListener("change", () => {
      if (select.value === "") return;
      sortTable(table, Number(select.value), "ascending");
    });
    directionButton.addEventListener("click", () => {
      if (tableState.get(table).column !== null) sortTable(table, tableState.get(table).column);
    });
    updateSortState(table);
  }

  function enhanceCapturedDisclosures() {
    for (const [index, row] of [...prototype.querySelectorAll(".captured-table tbody tr")].entries()) {
      const header = row.querySelector('th[scope="row"]');
      const pokemon = header.textContent.trim();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "record-detail-toggle";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", "capture-detail-" + (index + 1));
      const name = document.createElement("span");
      name.className = "record-detail-name";
      name.textContent = pokemon;
      const affordance = document.createElement("span");
      affordance.className = "record-detail-affordance";
      affordance.textContent = "Details ⌄";
      button.append(name, affordance);

      const detail = document.createElement("div");
      detail.className = "record-detail-body";
      detail.id = "capture-detail-" + (index + 1);
      detail.hidden = true;
      detail.setAttribute("role", "group");
      detail.setAttribute("aria-label", "Capture details for " + pokemon);
      for (const [field, value] of [
        ["Captured at", row.dataset.capturedAt],
        ["Ball", row.dataset.capturedBall],
        ["Chance", row.dataset.capturedChance]
      ]) {
        const group = document.createElement("span");
        const label = document.createElement("b");
        label.textContent = field;
        const data = document.createElement("span");
        data.textContent = value || "—";
        group.append(label, data);
        detail.appendChild(group);
      }
      header.replaceChildren(button, detail);
      button.addEventListener("click", () => {
        const open = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(open));
        detail.hidden = !open;
      });
    }
  }

  function syncAdaptiveTables() {
    // The frame is fixed in this prototype but ResizeObserver also handles
    // an actual panel-width change if embedded in a different static shell.
    const measured = prototype.getBoundingClientRect().width;
    const width = measured > 0 ? measured : VIEWPORTS[prototype.dataset.viewport].width;
    for (const table of tables) {
      const needsDense = table.classList.contains("captured-table") ||
        table.classList.contains("gallery-table") ||
        width < 540 && !table.classList.contains("rarity-table");
      const presentation = needsDense ? "dense" : "table";
      table.dataset.presentation = presentation;
      table.parentElement.dataset.presentation = presentation;
      const state = tableState.get(table);
      if (!state) continue;
      state.toolbar.hidden = !needsDense;
      for (const th of state.headers) {
        const button = th.querySelector(".sort-header-button");
        if (button) button.tabIndex = needsDense ? -1 : 0;
      }
    }
  }

  function syncFilterDisclosures(viewport) {
    const compact = viewport.width <= 470;
    for (const filter of prototype.querySelectorAll(".filter-disclosure")) {
      if (filter.dataset.userTouched === "true") continue;
      filter.open = !compact;
    }
  }
  for (const filter of prototype.querySelectorAll(".filter-disclosure")) {
    filter.addEventListener("click", (event) => {
      if (event.target.closest("summary")?.parentElement === filter) {
        filter.dataset.userTouched = "true";
      }
    });
  }

  enhanceCapturedDisclosures();
  for (const table of tables) enhanceTable(table);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncAdaptiveTables).observe(prototype);
  }

  for (const toggle of prototype.querySelectorAll(".history-detail-toggle")) {
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      applyHistoryPeriod();
    });
  }

  function setScreen(screen, focus = false) {
    if (!SCREENS.includes(screen)) return;
    const mode = prototype.dataset.mode;
    prototype.dataset.screen = screen;
    screenSelect.value = screen;
    for (const name of SCREENS) {
      const panel = document.getElementById("screen-" + name);
      const active = name === screen;
      panel.hidden = !active;
      panel.setAttribute("aria-labelledby", mode + "-" + name);
    }
    for (const tab of appTabs) {
      const selected = tab.dataset.screen === screen;
      const modeVisible = tab.id.startsWith(mode + "-");
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected && modeVisible));
      tab.tabIndex = selected && modeVisible ? 0 : -1;
    }
    const viewport = VIEWPORTS[prototype.dataset.viewport];
    currentRoute.textContent = screen.toUpperCase() + " / " + viewport.mode.toUpperCase() + " " + viewport.width;
    scrollRoot.scrollTop = 0;
    if (focus) prototype.querySelector("#" + mode + "-" + screen).focus();
  }

  function setViewport(viewportId) {
    const viewport = VIEWPORTS[viewportId];
    if (!viewport) return;
    prototype.dataset.viewport = viewportId;
    prototype.dataset.mode = viewport.mode;
    dimensionLabel.textContent = viewport.width + " × " + viewport.height;
    previewCaption.textContent = viewport.caption;
    for (const button of viewportButtons) {
      const selected = button.dataset.viewport === viewportId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    syncFilterDisclosures(viewport);
    syncAdaptiveTables();
    setScreen(prototype.dataset.screen);
  }

  function setHistoryScreen(name, focus = false) {
    if (!HISTORY_SCREENS.includes(name)) return;
    for (const subScreen of HISTORY_SCREENS) {
      document.getElementById("history-" + subScreen).hidden = subScreen !== name;
    }
    for (const tab of historyTabs) {
      const selected = tab.dataset.history === name;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (focus) document.getElementById("history-tab-" + name).focus();
  }

  function rovingKeys(event, tabs, names, change) {
    const active = tabs.indexOf(event.currentTarget);
    if (active < 0) return;
    let next;
    if (event.key === "ArrowRight") next = (active + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (active + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    change(names[next], true);
  }

  for (const button of viewportButtons) {
    button.addEventListener("click", () => setViewport(button.dataset.viewport));
  }
  screenSelect.addEventListener("change", () => setScreen(screenSelect.value));
  for (const tab of appTabs) {
    tab.addEventListener("click", () => setScreen(tab.dataset.screen));
    tab.addEventListener("keydown", (event) => {
      const visibleTabs = appTabs.filter((candidate) => candidate.id.startsWith(prototype.dataset.mode + "-"));
      rovingKeys(event, visibleTabs, SCREENS, setScreen);
    });
  }
  for (const tab of historyTabs) {
    tab.addEventListener("click", () => setHistoryScreen(tab.dataset.history));
    tab.addEventListener("keydown", (event) => rovingKeys(event, historyTabs, HISTORY_SCREENS, setHistoryScreen));
  }

  function optionalNumber(element) {
    if (!element || element.value.trim() === "") return null;
    const value = Number(element.value);
    return Number.isFinite(value) ? value : null;
  }

  function applySyntheticTableFilter(name) {
    const group = prototype.querySelector('[data-filter-group="' + name + '"]');
    const tbody = prototype.querySelector('[data-filter-table="' + name + '"]');
    if (!group || !tbody) return;
    const rarityPicker = group.querySelector(".multiselect");
    const rarityChecks = rarityPicker ? [...rarityPicker.querySelectorAll("[data-rarity-value]")] : [];
    const enabledRarities = new Set(rarityChecks.filter((check) => check.checked).map((check) => check.dataset.rarityValue));
    const raritySelect = group.querySelector("[data-filter-rarity]");
    const shiny = group.querySelector("[data-filter-shiny]")?.value || "all";
    const qualityMin = optionalNumber(group.querySelector("[data-filter-quality]"));
    const ivMin = optionalNumber(group.querySelector("[data-filter-iv]"));

    if (rarityPicker) {
      const label = rarityPicker.querySelector("[data-rarity-label]");
      if (enabledRarities.size === 7) label.textContent = "All (7)";
      else if (enabledRarities.size === 0) label.textContent = "None";
      else if (enabledRarities.size === 1) label.textContent = [...enabledRarities][0];
      else label.textContent = enabledRarities.size + " selected";
    }

    const disclosure = prototype.querySelector('[data-filter-disclosure="' + name + '"]');
    const summary = disclosure?.querySelector("[data-filter-summary]");
    if (summary) {
      const raritySummary = rarityPicker
        ? enabledRarities.size === 7 ? "7 rarities" : enabledRarities.size + " rarities"
        : raritySelect.value === "all" ? "all rarities" : raritySelect.value;
      summary.textContent = [raritySummary,
        shiny === "all" ? "Shiny all" : "Shiny " + shiny,
        qualityMin === null ? null : "Qlt >" + qualityMin,
        ivMin === null ? null : "IV >" + ivMin
      ].filter(Boolean).join(" · ");
    }

    let matches = 0;
    for (const row of tbody.querySelectorAll("tr")) {
      const rarityOk = rarityPicker
        ? enabledRarities.has(row.dataset.rarity)
        : raritySelect.value === "all" || raritySelect.value === row.dataset.rarity;
      const shinyOk = shiny === "all" || shiny === row.dataset.shiny;
      const qualityOk = qualityMin === null || row.dataset.quality !== "" && Number(row.dataset.quality) > qualityMin;
      const ivOk = ivMin === null || row.dataset.iv !== "" && Number(row.dataset.iv) > ivMin;
      const visible = rarityOk && shinyOk && qualityOk && ivOk;
      row.hidden = !visible;
      if (visible) matches += 1;
    }
    document.getElementById(name + "-count").textContent = matches + " shown";
    document.getElementById(name + "-empty").hidden = matches > 0;
  }

  for (const name of ["captured", "failed"]) {
    const group = prototype.querySelector('[data-filter-group="' + name + '"]');
    group.addEventListener("change", () => applySyntheticTableFilter(name));
    group.addEventListener("input", () => applySyntheticTableFilter(name));
  }

  function applyHistoryPeriod() {
    const selected = document.getElementById("history-period").value;
    const filterSummary = document.getElementById("history-filter-summary");
    if (filterSummary) filterSummary.textContent =
      document.querySelector('#history-period option[value="' + selected + '"]').textContent + " · other filters demo";
    let matchingRows = 0;
    for (const row of document.querySelectorAll("[data-history-period]")) {
      const entry = row.dataset.historyPeriod;
      const visible = selected === "all" || selected === "30d" ||
        selected === "7d" || selected === entry;
      const expanded = row.classList.contains("history-detail")
        ? prototype.querySelector('[aria-controls="' + row.id + '"]')?.getAttribute("aria-expanded") !== "false"
        : true;
      row.hidden = !visible || !expanded;
      if (visible && !row.classList.contains("history-detail")) matchingRows += 1;
    }
    document.getElementById("history-total").textContent = String(matchingRows);
  }
  document.getElementById("history-period").addEventListener("change", applyHistoryPeriod);

  function applyGalleryFilter() {
    const query = document.getElementById("gallery-search").value.trim().toLocaleLowerCase("pt-BR");
    const rarity = document.getElementById("gallery-rarity").value;
    const summary = prototype.querySelector(".gallery-filter-disclosure > summary span:first-of-type");
    if (summary) summary.textContent = (query || "All Pokémon") + " · " + rarity;
    let matches = 0;
    for (const row of document.querySelectorAll("#gallery-body tr")) {
      const nameMatches = row.dataset.galleryName.toLocaleLowerCase("pt-BR").includes(query);
      const rarityMatches = rarity === "all" || row.dataset.galleryRarity.split(" ").includes(rarity);
      row.hidden = !(nameMatches && rarityMatches);
      if (!row.hidden) matches += 1;
    }
    document.getElementById("gallery-count").textContent = matches + " shown";
    document.getElementById("gallery-empty").hidden = matches > 0;
  }
  document.getElementById("gallery-search").addEventListener("input", applyGalleryFilter);
  document.getElementById("gallery-rarity").addEventListener("change", applyGalleryFilter);

  const hudLauncher = document.getElementById("hud-launcher");
  const hudLayout = document.getElementById("hud-layout");
  const hudPreset = document.getElementById("hud-preset");
  const hudGrid = hudLauncher.querySelector(".hud-widget-grid");
  const hudWidgets = [...hudGrid.querySelectorAll("[data-hud-slot]")];
  const rarityTemplate = hudGrid.querySelector(".hud-rarity-row").cloneNode(true);
  const slotCards = [...prototype.querySelectorAll("[data-slot-config]")];
  const slotDescriptions = [
    "First unit", "Second unit", "Third unit", "Fourth unit"
  ];

  function rarityTrackerView() {
    const content = rarityTemplate.cloneNode(true);
    const labelParts = [];
    for (const item of content.querySelectorAll("[data-hud-rarity]")) {
      const rarity = item.dataset.hudRarity;
      const source = prototype.querySelector(".rarity-table tbody .rarity-" + rarity);
      const captured = source?.parentElement.querySelectorAll("td")[1]?.textContent.trim();
      const name = source?.textContent.trim();
      if (!captured || !name) throw new Error("Missing synthetic rarity: " + rarity);
      item.textContent = captured;
      item.title = name + ": " + captured + " captured";
      labelParts.push(name + ": " + captured);
    }
    content.setAttribute("aria-label", "Captured by rarity · " + labelParts.join(" · "));
    return content;
  }

  function applyHudExample() {
    const dimensions = {
      "2": "2 Columns · 220 × 52",
      "1": "One Column · 145 × 52",
      "0": "PX Only · 52 × 52"
    };
    const preset = HUD_PRESETS[hudPreset.value] || HUD_PRESETS.default;
    hudLauncher.dataset.hudLayout = hudLayout.value;
    document.getElementById("hud-dimensions").textContent = dimensions[hudLayout.value];
    hudGrid.setAttribute("aria-label", "Preset " + hudPreset.value + " · " + preset.map((entry) => entry.name).join(" / "));
    hudLauncher.setAttribute("aria-label", hudLayout.value === "0"
      ? "PX Only: apenas o monograma PX visível"
      : "Launcher " + dimensions[hudLayout.value] + " · preset " + hudPreset.value);
    for (let index = 0; index < 4; index += 1) {
      const item = preset[index];
      const wide = item.widget === "rarityTracker" && item.size === 2 && index % 2 === 0;
      const consumed = index % 2 === 1 && preset[index - 1]?.size === 2;
      const hiddenByLayout = hudLayout.value === "0" || hudLayout.value === "1" && index % 2 === 1;
      const widget = hudWidgets[index];
      widget.dataset.widget = item.widget;
      widget.dataset.size = String(item.size || 1);
      widget.dataset.consumed = String(consumed);
      widget.classList.toggle("hud-widget--wide", wide);
      widget.hidden = consumed || item.widget === "empty" || hiddenByLayout;
      widget.replaceChildren();
      if (wide) {
        widget.setAttribute("aria-label", "Rarity Tracker Captured (slots " + (index + 1) + " e " + (index + 2) + ")");
        widget.appendChild(rarityTrackerView());
      } else if (item.widget !== "empty") {
        widget.removeAttribute("aria-label");
        const label = document.createElement("span");
        label.dataset.hudLabel = "";
        label.textContent = item.label;
        const value = document.createElement("strong");
        value.dataset.hudValue = "";
        value.textContent = item.value;
        value.classList.toggle("positive", item.tone === "positive");
        widget.append(label, value);
      } else {
        widget.removeAttribute("aria-label");
      }

      const card = slotCards[index];
      card.querySelector("[data-slot-name]").textContent = item.name;
      card.querySelector("[data-slot-caption]").textContent = consumed
        ? "Consumed by slot " + String(index).padStart(2, "0")
        : wide
          ? "Wide · spans slots " + String(index + 1).padStart(2, "0") + " + " + String(index + 2).padStart(2, "0")
          : slotDescriptions[index];
      card.classList.toggle("slot-card--consumed", consumed);
      card.dataset.consumed = String(consumed);
      card.hidden = hudLayout.value === "0" || hudLayout.value === "1" && index % 2 === 1;
    }
  }
  hudLayout.addEventListener("change", applyHudExample);
  hudPreset.addEventListener("change", applyHudExample);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const disclosure of prototype.querySelectorAll(".multiselect[open], .advanced-filters[open]")) {
      disclosure.open = false;
    }
  });

  // Query parameters allow deterministic reference screenshots over file://.
  // Example: index.html?viewport=mobile-390&screen=history&history=attempts
  const query = new URLSearchParams(window.location.search);
  const requestedViewport = query.get("viewport") || "desktop-415";
  const requestedScreen = query.get("screen") || "current";
  const requestedHistory = query.get("history") || "hunts";
  const requestedHudLayout = query.get("hudLayout");
  const requestedHudPreset = query.get("hudPreset");
  if (["0", "1", "2"].includes(requestedHudLayout)) hudLayout.value = requestedHudLayout;
  if (Object.hasOwn(HUD_PRESETS, requestedHudPreset)) hudPreset.value = requestedHudPreset;
  setViewport(VIEWPORTS[requestedViewport] ? requestedViewport : "desktop-415");
  setScreen(SCREENS.includes(requestedScreen) ? requestedScreen : "current");
  setHistoryScreen(HISTORY_SCREENS.includes(requestedHistory) ? requestedHistory : "hunts");
  applySyntheticTableFilter("captured");
  applySyntheticTableFilter("failed");
  applyHistoryPeriod();
  applyGalleryFilter();
  applyHudExample();
})();
