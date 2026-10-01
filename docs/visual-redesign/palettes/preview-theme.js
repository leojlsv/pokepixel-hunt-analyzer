/** Offline-only reference. Approved palette CSS is owned by the production runtime. */
import { PALETTES, PALETTE_STYLES, normalizePalette } from "../../../userscript/palette-theme.js";

export const PALETTE_PREVIEWS = PALETTES;
export const normalizePalettePreview = normalizePalette;

const PREVIEW_CSS = PALETTE_STYLES.replaceAll("data-pha-palette", "data-pha-preview-palette");

export function applyPalettePreview(shadow, palette) {
  const selected = normalizePalettePreview(palette);
  const host = shadow?.host;
  if (!host) return selected;
  shadow.getElementById("pha-offline-palette-preview")?.remove();
  const sheet = shadow.ownerDocument.createElement("style");
  sheet.id = "pha-offline-palette-preview";
  sheet.textContent = PREVIEW_CSS;
  shadow.appendChild(sheet);
  host.setAttribute("data-pha-preview-palette", selected);
  return selected;
}
