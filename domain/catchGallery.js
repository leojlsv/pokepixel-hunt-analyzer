import { canGenerateCaptureTicket } from "./captureTicket.js";

export const CATCH_GALLERY_PAGE_SIZE = 5;
export const CATCH_GALLERY_SORT_KEYS = Object.freeze({
  CAPTURED: "captured",
  QUALITY: "quality",
  IV: "iv"
});

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function matchesCatchGalleryFilters(encounter, { pokemon = "", rarity = "all" } = {}) {
  if (!canGenerateCaptureTicket(encounter)) return false;

  const pokemonFilter = normalizeText(pokemon);
  if (pokemonFilter && !normalizeText(encounter.speciesName).includes(pokemonFilter)) {
    return false;
  }

  switch (rarity) {
    case "legendary":
      return encounter.quality === "legendary";
    case "mythical":
      return encounter.quality === "mythical";
    case "shiny":
      return encounter.isShiny === true;
    default:
      return true;
  }
}

function sortValue(encounter, key) {
  switch (key) {
    case CATCH_GALLERY_SORT_KEYS.QUALITY:
      return Number(encounter.qualityMultiplier);
    case CATCH_GALLERY_SORT_KEYS.IV:
      return Number(encounter.ivTotal);
    case CATCH_GALLERY_SORT_KEYS.CAPTURED:
    default:
      return Number(encounter.captureAtMs);
  }
}

export function sortCatchGallery(encounters, {
  key = CATCH_GALLERY_SORT_KEYS.CAPTURED,
  direction = "desc"
} = {}) {
  const sign = direction === "asc" ? 1 : -1;
  return [...encounters].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    const aFinite = Number.isFinite(av);
    const bFinite = Number.isFinite(bv);

    if (aFinite !== bFinite) return aFinite ? -1 : 1;
    if (aFinite && av !== bv) return (av - bv) * sign;

    const captureTie = (Number(b.captureAtMs) || 0) - (Number(a.captureAtMs) || 0);
    if (captureTie) return captureTie;
    return String(a.encounterId || "").localeCompare(String(b.encounterId || ""));
  });
}

export function buildCatchGalleryRows(encounters, {
  pokemon = "",
  rarity = "all",
  sortKey = CATCH_GALLERY_SORT_KEYS.CAPTURED,
  sortDirection = "desc"
} = {}) {
  const filtered = (Array.isArray(encounters) ? encounters : [])
    .filter((encounter) => matchesCatchGalleryFilters(encounter, { pokemon, rarity }));

  return sortCatchGallery(filtered, {
    key: sortKey,
    direction: sortDirection
  });
}

export function paginateCatchGallery(rows, page = 1, pageSize = CATCH_GALLERY_PAGE_SIZE) {
  const size = Math.max(1, Number(pageSize) || CATCH_GALLERY_PAGE_SIZE);
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / size));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (currentPage - 1) * size;

  return {
    rows: rows.slice(start, start + size),
    page: currentPage,
    pageSize: size,
    totalRows,
    totalPages
  };
}
