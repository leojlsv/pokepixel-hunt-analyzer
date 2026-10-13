import { canGenerateCaptureTicket } from "../domain/captureTicket.js";

/**
 * Strip analytics/session relationships from an existing Gallery ticket.
 * Return null when the row was never eligible for the Gallery's sparse index.
 * The resulting row can stay in `encounters` as a standalone gallery record,
 * while no longer contributing to Current or History's per-session queries.
 */
export function archivedCatchGalleryRow(row) {
  if (!row || !canGenerateCaptureTicket(row)
    || !Number.isFinite(row.captureTicketAtMs)
    || row.captureTicketAtMs !== row.captureAtMs) return null;

  return {
    encounterId: row.encounterId,
    captureTicketAtMs: row.captureAtMs,
    captureAtMs: row.captureAtMs,
    captureResult: "success",
    speciesName: row.speciesName,
    quality: row.quality,
    qualityMultiplier: row.qualityMultiplier,
    ivTotal: row.ivTotal,
    capturedByName: row.capturedByName,
    isShiny: row.isShiny === true
  };
}
