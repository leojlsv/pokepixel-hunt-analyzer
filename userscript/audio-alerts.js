import {
  AUDIO_ALERT_KEYS,
  defaultAudioAlertSettings,
  selectAudioAlertKey
} from "../domain/audioAlertPolicy.js";
import epicCaptured from "./audio-assets/epic-captured.js";
import epicFled from "./audio-assets/epic-fled.js";
import legendaryCaptured from "./audio-assets/legendary-captured.js";
import legendaryFled from "./audio-assets/legendary-fled.js";
import mythicCaptured from "./audio-assets/mythic-captured.js";
import mythicFled from "./audio-assets/mythic-fled.js";
import shinyCaptured from "./audio-assets/shiny-captured.js";
import shinyFled from "./audio-assets/shiny-fled.js";
import { SET2_SEGMENTS, SET2_SPRITE_URI } from "./audio-assets/set2/sprite.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STORAGE_KEY = "pokepixel_hunt_analyzer_audio_alerts_v1";
const SOUND_SET_STORAGE_KEY = "pokepixel_hunt_analyzer_audio_set_v1";
const STYLE_ID = "pha-audio-alert-styles";
const TAB_ID = "alerts-tab";
const VIEW_ID = "view-alerts";

const AUDIO_URLS = Object.freeze({
  epic_captured: epicCaptured,
  epic_fled: epicFled,
  legendary_captured: legendaryCaptured,
  legendary_fled: legendaryFled,
  mythic_captured: mythicCaptured,
  mythic_fled: mythicFled,
  shiny_captured: shinyCaptured,
  shiny_fled: shinyFled
});

const ALERT_ROWS = Object.freeze([
  { label: "Epic", className: "rarity-epic", key: "epic" },
  { label: "Legendary", className: "rarity-legendary", key: "legendary" },
  { label: "Mythical", className: "rarity-mythical", key: "mythic" },
  { label: "Shiny", className: "alert-shiny", key: "shiny" }
]);

const ALERT_STYLES = `
  .alerts-view {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .alert-grid {
    padding: 10px;
    display: grid;
    grid-template-columns: minmax(110px, 1fr) 90px 90px;
    gap: 9px 10px;
    align-items: center;
    background: var(--bg-elevated);
  }

  .alert-grid > b {
    color: #9e9270;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .03em;
    text-align: center;
    text-transform: uppercase;
  }

  .alert-name {
    overflow: hidden;
    font-size: 10px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .alert-shiny { color: var(--gold); }

  .alert-grid label {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .alert-grid input[type="checkbox"] {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: var(--gold);
    cursor: pointer;
  }

  .sound-set-control {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
    font-size: 9px;
    white-space: nowrap;
  }

  .sound-set-control select {
    height: 22px;
    min-width: 58px;
    padding: 2px 5px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg);
    color: var(--text);
    font-size: 9px;
  }

  .alert-help {
    padding: 8px 10px;
    border-top: 1px solid var(--border-soft);
    color: var(--muted);
    font-size: 9px;
    line-height: 1.35;
  }
`;

function readSettings() {
  const defaults = defaultAudioAlertSettings();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object") return defaults;
    for (const key of AUDIO_ALERT_KEYS) {
      defaults[key] = stored[key] === true;
    }
  } catch {
    // Invalid local state falls back to every alert disabled.
  }
  return defaults;
}

function readSoundSet() {
  return localStorage.getItem(SOUND_SET_STORAGE_KEY) === "2" ? "2" : "1";
}

function alertRowsMarkup() {
  return ALERT_ROWS.map(({ label, className, key }) => `
    <span class="alert-name ${className}">${label}</span>
    <label title="${label} captured">
      <input type="checkbox" data-audio-alert="${key}_captured" aria-label="${label} captured sound alert">
    </label>
    <label title="${label} fled">
      <input type="checkbox" data-audio-alert="${key}_fled" aria-label="${label} fled sound alert">
    </label>`).join("");
}

function dataUriToArrayBuffer(uri) {
  const comma = uri.indexOf(",");
  if (comma < 0) throw new Error("Invalid embedded audio data URI");
  const binary = atob(uri.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export function createAudioAlerts() {
  const settings = readSettings();
  const set1Buffers = new Map();
  let soundSet = readSoundSet();
  let set2Buffer = null;
  let audioContext = null;
  let currentSource = null;
  let currentKey = null;
  let boundShadow = null;
  let gestureUnlockInstalled = false;
  let mountRetry = null;

  function writeSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function writeSoundSet() {
    localStorage.setItem(SOUND_SET_STORAGE_KEY, soundSet);
  }

  function getAudioContext() {
    if (audioContext) return audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
    return audioContext;
  }

  async function unlock() {
    const context = getAudioContext();
    if (!context) return false;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }
    return context.state === "running";
  }

  function installGestureUnlock() {
    if (gestureUnlockInstalled) return;
    gestureUnlockInstalled = true;

    const attempt = () => {
      void unlock().then((ready) => {
        if (!ready) return;
        window.removeEventListener("pointerdown", attempt, true);
        window.removeEventListener("keydown", attempt, true);
      });
    };

    window.addEventListener("pointerdown", attempt, true);
    window.addEventListener("keydown", attempt, true);
  }

  async function loadSet1Buffer(key) {
    if (set1Buffers.has(key)) return set1Buffers.get(key);
    const context = getAudioContext();
    const uri = AUDIO_URLS[key];
    if (!context || !uri) return null;

    const buffer = await context.decodeAudioData(dataUriToArrayBuffer(uri));
    set1Buffers.set(key, buffer);
    return buffer;
  }

  async function loadSet2Buffer() {
    if (set2Buffer) return set2Buffer;
    const context = getAudioContext();
    if (!context) return null;
    set2Buffer = await context.decodeAudioData(dataUriToArrayBuffer(SET2_SPRITE_URI));
    return set2Buffer;
  }

  function stopCurrent() {
    if (!currentSource) return;
    try {
      currentSource.stop();
    } catch {
      // Already stopped sources are harmless.
    }
    currentSource.disconnect();
    currentSource = null;
    currentKey = null;
  }

  async function playKey(key) {
    if (!(await unlock())) return false;

    try {
      const context = getAudioContext();
      if (!context) return false;

      const useSet2 = soundSet === "2";
      const segment = useSet2 ? SET2_SEGMENTS[key] : null;
      const buffer = useSet2 ? await loadSet2Buffer() : await loadSet1Buffer(key);
      if (!buffer || (useSet2 && !segment)) return false;

      stopCurrent();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.addEventListener("ended", () => {
        if (currentSource !== source) return;
        source.disconnect();
        currentSource = null;
        currentKey = null;
      }, { once: true });
      currentSource = source;
      currentKey = key;

      if (useSet2) {
        source.start(0, segment.offset, segment.duration);
      } else {
        source.start();
      }
      return true;
    } catch (error) {
      console.warn("PokePixel Hunt Analyzer (audio alert):", error);
      return false;
    }
  }

  function updateEnabledCount() {
    if (!boundShadow) return;
    const count = AUDIO_ALERT_KEYS.filter((key) => settings[key]).length;
    const badge = boundShadow.getElementById("alerts-enabled-count");
    if (badge) badge.textContent = `${count}/8`;
  }

  function bindControls(shadow) {
    boundShadow = shadow;

    const soundSetSelect = shadow.getElementById("audio-sound-set");
    if (soundSetSelect && soundSetSelect.dataset.audioBound !== "true") {
      soundSetSelect.dataset.audioBound = "true";
      soundSetSelect.value = soundSet;
      soundSetSelect.addEventListener("change", () => {
        soundSet = soundSetSelect.value === "2" ? "2" : "1";
        soundSetSelect.value = soundSet;
        writeSoundSet();
        stopCurrent();
      });
    } else if (soundSetSelect) {
      soundSetSelect.value = soundSet;
    }

    for (const checkbox of shadow.querySelectorAll("[data-audio-alert]")) {
      const key = checkbox.dataset.audioAlert;
      if (!AUDIO_ALERT_KEYS.includes(key) || checkbox.dataset.audioBound === "true") continue;
      checkbox.dataset.audioBound = "true";
      checkbox.checked = settings[key] === true;
      checkbox.addEventListener("change", () => {
        settings[key] = checkbox.checked;
        writeSettings();
        updateEnabledCount();
        if (!checkbox.checked && currentKey === key) stopCurrent();
        if (checkbox.checked) void playKey(key);
      });
    }

    updateEnabledCount();
    installGestureUnlock();
  }

  function showAlerts(shadow) {
    const historyTab = shadow.querySelector('[data-view="history"]');
    // Keep the main UI state out of Current while Misc is visible so its
    // one-second Current refresh stays suspended.
    historyTab?.click();

    shadow.getElementById("view-current").hidden = true;
    shadow.getElementById("view-history").hidden = true;
    shadow.getElementById(VIEW_ID).hidden = false;
    for (const tab of shadow.querySelectorAll("[data-view]")) tab.classList.remove("active");
    shadow.getElementById(TAB_ID).classList.add("active");
  }

  function hideAlerts(shadow) {
    const view = shadow.getElementById(VIEW_ID);
    const tab = shadow.getElementById(TAB_ID);
    if (view) view.hidden = true;
    if (tab) tab.classList.remove("active");
  }

  function mountControls() {
    const shadow = document.getElementById(ROOT_ID)?.shadowRoot;
    const panel = shadow?.getElementById("pha-panel");
    const tabs = shadow?.querySelector(".tabs");
    const huntTime = shadow?.getElementById("hunt-time");
    if (!shadow || !panel || !tabs || !huntTime) {
      if (!mountRetry) {
        mountRetry = window.setTimeout(() => {
          mountRetry = null;
          mountControls();
        }, 50);
      }
      return false;
    }

    if (!shadow.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = ALERT_STYLES;
      shadow.appendChild(style);
    }

    let alertsTab = shadow.getElementById(TAB_ID);
    if (!alertsTab) {
      alertsTab = document.createElement("button");
      alertsTab.id = TAB_ID;
      alertsTab.className = "tab";
      alertsTab.type = "button";
      alertsTab.textContent = "Misc";
      huntTime.before(alertsTab);
    }

    let alertsView = shadow.getElementById(VIEW_ID);
    if (!alertsView) {
      alertsView = document.createElement("section");
      alertsView.id = VIEW_ID;
      alertsView.className = "view alerts-view";
      alertsView.hidden = true;
      alertsView.innerHTML = `
        <section class="section">
          <div class="section-head">
            <h3>Sound Alerts</h3>
            <div class="section-meta">
              <label class="sound-set-control">Sound Set
                <select id="audio-sound-set" aria-label="Sound Set">
                  <option value="1">Set 1</option>
                  <option value="2">Set 2</option>
                </select>
              </label>
              <span id="alerts-enabled-count" class="section-badge">0/8</span>
            </div>
          </div>
          <div class="alert-grid">
            <span></span><b>Captured</b><b>Fled</b>
            ${alertRowsMarkup()}
          </div>
          <div class="alert-help">
            Choose a Sound Set, then enable only the alerts you want. Enabling an option plays the selected set once as preview.<br>
            If a Pokémon is Shiny and also Epic/Legendary/Mythical, the enabled Shiny alert has priority.
          </div>
        </section>`;
      panel.appendChild(alertsView);
    }

    if (alertsTab.dataset.audioBound !== "true") {
      alertsTab.dataset.audioBound = "true";
      alertsTab.addEventListener("click", () => showAlerts(shadow));

      for (const tab of shadow.querySelectorAll("[data-view]")) {
        tab.addEventListener("click", () => hideAlerts(shadow));
      }
    }

    bindControls(shadow);
    return true;
  }

  async function handleTerminalAlert(alert) {
    const key = selectAudioAlertKey(alert, settings);
    return key ? playKey(key) : false;
  }

  return {
    mountControls,
    handleTerminalAlert
  };
}
