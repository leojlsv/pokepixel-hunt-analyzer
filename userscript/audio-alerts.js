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

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STORAGE_KEY = "pokepixel_hunt_analyzer_audio_alerts_v1";
const UI_STORAGE_KEY = "pokepixel_hunt_analyzer_audio_alerts_ui_v1";
const STYLE_ID = "pha-audio-alert-styles";
const SECTION_ID = "alerts-section";

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
  .alert-grid {
    padding: 7px 10px 8px;
    display: grid;
    grid-template-columns: minmax(90px, 1fr) 72px 72px;
    gap: 6px 8px;
    align-items: center;
    background: var(--bg-elevated);
  }

  .alert-grid > b {
    color: #9e9270;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .03em;
    text-align: center;
    text-transform: uppercase;
  }

  .alert-name {
    overflow: hidden;
    font-size: 10px;
    font-weight: 700;
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
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--gold);
    cursor: pointer;
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

function readCollapsed() {
  return localStorage.getItem(UI_STORAGE_KEY) === "collapsed";
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

export function createAudioAlerts() {
  const settings = readSettings();
  const buffers = new Map();
  let audioContext = null;
  let currentSource = null;
  let currentKey = null;
  let boundShadow = null;
  let gestureUnlockInstalled = false;

  function writeSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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

  async function loadBuffer(key) {
    if (buffers.has(key)) return buffers.get(key);
    const context = getAudioContext();
    const uri = AUDIO_URLS[key];
    if (!context || !uri) return null;

    const buffer = await context.decodeAudioData(dataUriToArrayBuffer(uri));
    buffers.set(key, buffer);
    return buffer;
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

  function updateEnabledCount() {
    if (!boundShadow) return;
    const count = AUDIO_ALERT_KEYS.filter((key) => settings[key]).length;
    const badge = boundShadow.getElementById("alerts-enabled-count");
    if (badge) badge.textContent = `${count}/8`;
  }

  function setCollapsed(section, button, collapsed) {
    section.classList.toggle("collapsed", collapsed);
    button.textContent = collapsed ? "▸" : "▾";
    button.title = collapsed ? "Expand" : "Collapse";
    button.setAttribute("aria-expanded", String(!collapsed));
    localStorage.setItem(UI_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  }

  function bindControls(shadow) {
    boundShadow = shadow;

    for (const checkbox of shadow.querySelectorAll("[data-audio-alert]")) {
      const key = checkbox.dataset.audioAlert;
      if (!AUDIO_ALERT_KEYS.includes(key)) continue;
      checkbox.checked = settings[key] === true;
      checkbox.addEventListener("change", () => {
        settings[key] = checkbox.checked;
        writeSettings();
        updateEnabledCount();
        if (!checkbox.checked && currentKey === key) stopCurrent();
        if (checkbox.checked) void unlock();
      });
    }

    updateEnabledCount();
    installGestureUnlock();
  }

  function mountControls() {
    const shadow = document.getElementById(ROOT_ID)?.shadowRoot;
    const raritySection = shadow?.getElementById("rarity-section");
    if (!shadow || !raritySection) return false;
    if (shadow.getElementById(SECTION_ID)) return true;

    if (!shadow.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = ALERT_STYLES;
      shadow.appendChild(style);
    }

    const section = document.createElement("section");
    section.id = SECTION_ID;
    section.className = "section alert-section";
    section.innerHTML = `
      <div class="section-head">
        <h3>Sound Alerts</h3>
        <div class="section-meta">
          <span id="alerts-enabled-count" class="section-badge">0/8</span>
          <button id="alerts-collapse" class="collapse-button" type="button" title="Collapse">▾</button>
        </div>
      </div>
      <div class="alert-grid" title="Shiny sound has priority over rarity when both matching alerts are enabled.">
        <span></span><b>Captured</b><b>Fled</b>
        ${alertRowsMarkup()}
      </div>`;

    raritySection.before(section);
    const collapseButton = shadow.getElementById("alerts-collapse");
    collapseButton.addEventListener("click", () => {
      setCollapsed(section, collapseButton, !section.classList.contains("collapsed"));
    });
    setCollapsed(section, collapseButton, readCollapsed());
    bindControls(shadow);
    return true;
  }

  async function handleTerminalAlert(alert) {
    const key = selectAudioAlertKey(alert, settings);
    if (!key) return false;
    if (!(await unlock())) return false;

    try {
      const buffer = await loadBuffer(key);
      const context = getAudioContext();
      if (!buffer || !context) return false;

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
      source.start();
      return true;
    } catch (error) {
      console.warn("PokePixel Hunt Analyzer (audio alert):", error);
      return false;
    }
  }

  return {
    mountControls,
    handleTerminalAlert
  };
}
