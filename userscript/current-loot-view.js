import { aggregateLootHistory } from "./loot-history-model.js";
import {
  knownLootItemRarity,
  lootItemCatalogSignature
} from "./loot-item-catalog.js";
import { bindLootRarityFilter } from "./loot-rarity-filter.js";
import {
  RARITIES,
  formatCompact,
  formatNumber,
  rarityClass,
  speciesLabel
} from "./ui-utils.js";

const RARITY_BY_KEY = new Map(RARITIES);

function itemRarity(item) {
  const value = knownLootItemRarity(item?.rarity);
  return RARITY_BY_KEY.has(value) ? value : "none";
}

/**
 * Current-only projection; never reads all History sessions or drives the
 * one-second Current refresh into an encounter scan. Aggregation runs only
 * on a new session or a changed encounter-data revision.
 */
export function createCurrentLootView(shadow, { getLootItemCatalog = () => null } = {}) {
  let sessionId = undefined;
  let dataRevision = undefined;
  let summary = aggregateLootHistory();
  let currentCatalogSignature = "";
  const expandedItems = new Set();

  const rarityFilter = bindLootRarityFilter(shadow, {
    prefix: "current-loot",
    scope: "current",
    onChange: () => renderContents({ preserveScroll: true })
  });

  function render({
    sessionId: nextSessionId = null,
    lootDataRevision = 0,
    encounters = []
  } = {}) {
    const changedSession = sessionId !== nextSessionId;
    if (!changedSession && dataRevision === lootDataRevision) {
      // Native Bag rarity can become available after the Inventory API
      // snapshot. Check metadata on the existing Current refresh without
      // revisiting or re-aggregating encounter records.
      if (!shadow.getElementById("view-current")?.hidden && summary.items.length > 0) {
        refreshCatalog();
      }
      return;
    }
    sessionId = nextSessionId;
    dataRevision = lootDataRevision;
    if (changedSession) expandedItems.clear();
    summary = aggregateLootHistory(
      sessionId == null ? [] : [{ session: { sessionId }, encounters }]
    );
    renderContents({ preserveScroll: !changedSession });
  }

  function presentItem(cell, itemId, catalog) {
    const metadata = catalog?.get?.(itemId);
    const name = typeof metadata?.name === "string" && metadata.name.trim()
      ? metadata.name.trim()
      : itemId;
    const rarityKey = itemRarity(metadata);
    const rarityName = RARITY_BY_KEY.get(rarityKey);

    const title = document.createElement("span");
    title.className = `current-loot-item-name ${rarityName ? rarityClass(rarityKey) : ""}`.trim();
    title.textContent = name;
    title.title = itemId;

    const details = document.createElement("small");
    details.textContent = `${name === itemId ? "" : `${itemId} · `}${rarityName ? `Rarity: ${rarityName}` : "Rarity unknown"}`;
    cell.replaceChildren(title, details);
  }

  function createSourceDetails(item) {
    const row = document.createElement("tr");
    row.className = "current-loot-detail-row";
    const cell = document.createElement("td");
    cell.colSpan = 3;
    const label = document.createElement("strong");
    label.textContent = "Pokémon sources";
    const table = document.createElement("table");
    table.className = "current-loot-sources-table";
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    for (const text of ["Pokémon", "Qty", "Drops"]) {
      const th = document.createElement("th");
      th.textContent = text;
      header.appendChild(th);
    }
    thead.appendChild(header);
    const tbody = document.createElement("tbody");
    for (const source of item.sources) {
      const tr = document.createElement("tr");
      for (const value of [
        speciesLabel({ speciesName: source.speciesName }),
        formatNumber(source.qty),
        formatNumber(source.drops)
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    cell.append(label, table);
    row.appendChild(cell);
    return row;
  }

  function renderContents({ preserveScroll = false, catalog = getLootItemCatalog() } = {}) {
    currentCatalogSignature = lootItemCatalogSignature(summary.items, catalog);
    const visible = summary.items.filter((item) =>
      rarityFilter.matches(itemRarity(catalog?.get?.(item.itemId)))
    );

    const all = summary.items.length;
    shadow.getElementById("current-loot-count").textContent = rarityFilter.isAll()
      ? `${formatNumber(all)} ${all === 1 ? "item" : "items"}`
      : `${formatNumber(visible.length)}/${formatNumber(all)} items`;
    shadow.getElementById("current-loot-coverage").textContent =
      `${formatNumber(summary.lootedEncounters)} loot rewards · current session`;

    for (const [id, amount] of [
      ["current-loot-gold", summary.totals.directGold],
      ["current-loot-value", summary.totals.lootSellValue],
      ["current-loot-autosell", summary.totals.autoSellValue],
      ["current-loot-total", summary.totals.total]
    ]) {
      const element = shadow.getElementById(id);
      element.textContent = formatCompact(amount);
      element.title = formatNumber(amount);
    }

    const body = shadow.getElementById("current-loot-body");
    const wrap = shadow.querySelector(".current-loot-wrap");
    const scrollTop = preserveScroll ? wrap?.scrollTop : null;
    const fragment = document.createDocumentFragment();

    for (const item of visible) {
      const row = document.createElement("tr");
      row.className = "current-loot-row";
      row.dataset.itemId = item.itemId;
      row.tabIndex = 0;
      row.setAttribute("aria-expanded", String(expandedItems.has(item.itemId)));
      row.title = `${item.itemId} · click for Pokémon sources`;
      const firstCell = document.createElement("td");
      presentItem(firstCell, item.itemId, catalog);
      row.appendChild(firstCell);
      for (const amount of [item.qty, item.drops]) {
        const cell = document.createElement("td");
        cell.textContent = formatNumber(amount);
        row.appendChild(cell);
      }
      const toggle = () => {
        const focused = shadow.activeElement === row;
        if (expandedItems.has(item.itemId)) expandedItems.delete(item.itemId);
        else expandedItems.add(item.itemId);
        renderContents({ preserveScroll: true });
        if (focused) {
          [...body.querySelectorAll(".current-loot-row")]
            .find((candidate) => candidate.dataset.itemId === item.itemId)
            ?.focus({ preventScroll: true });
        }
      };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle();
      });
      fragment.appendChild(row);
      if (expandedItems.has(item.itemId)) fragment.appendChild(createSourceDetails(item));
    }

    if (visible.length === 0) {
      const row = document.createElement("tr");
      row.className = "current-loot-empty";
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.textContent = rarityFilter.isAll()
        ? "No item drops recorded in the current session."
        : "No item drops match this item rarity in the current session.";
      row.appendChild(cell);
      fragment.appendChild(row);
    }
    body.replaceChildren(fragment);
    if (scrollTop != null && wrap) wrap.scrollTop = scrollTop;
  }

  function refreshCatalog() {
    const catalog = getLootItemCatalog();
    const signature = lootItemCatalogSignature(summary.items, catalog);
    if (signature === currentCatalogSignature) return;
    if (!rarityFilter.isAll()) {
      renderContents({ preserveScroll: true, catalog });
      return;
    }
    for (const row of shadow.querySelectorAll("#current-loot-body .current-loot-row")) {
      presentItem(row.cells[0], row.dataset.itemId, catalog);
    }
    currentCatalogSignature = signature;
  }

  return { render, refreshCatalog };
}
