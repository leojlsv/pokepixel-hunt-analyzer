/**
 * JSON backup shape (docs/DEVELOPMENT.md §3): `formatVersion`,
 * `appVersion`, `sessions`, `configs`, `encounters`. "No raw/auth data" is
 * true by construction here — nothing upstream (hook.js, domain/events.js)
 * ever extracts a token/cookie/raw frame into these stores in the first
 * place, so this is a direct passthrough of already-fetched rows, not a
 * scrub step.
 *
 * Pure — no chrome APIs, no IndexedDB access. The Side Panel fetches
 * sessions/configs/encounters and its own
 * `chrome.runtime.getManifest().version` and passes them in.
 */

export const BACKUP_FORMAT_VERSION = 1;

export function buildJsonBackup({ appVersion, sessions = [], configs = [], encounters = [] }) {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: appVersion ?? "unknown",
    sessions,
    configs,
    encounters
  };
}
