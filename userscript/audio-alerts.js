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
const CHOICE_STORAGE_KEY = "pokepixel_hunt_analyzer_audio_choices_v1";
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
    grid-template-columns: minmax(105px, 1fr) 100px 100px;
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

  .alert-choice-pair {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
  }

  .alert-choice {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--muted);
    font-size: 8px;
    font-weight: 700;
    cursor: pointer;
  }

  .alert-choice input[type="checkbox"] {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: var(--gold);
    cursor: pointer;
  }

  .alert-help {
    padding: 8px 10px;
    border-top: 1px solid var(--border-soft);
    color: var(--muted);
    font-size: 9px;
    line-height: 1.35;
  }
`;

function readChoices() {
  const choices = Object.fromEntries(AUDIO_ALERT_KEYS.map((key) => [key, 0]));

  try {
    const stored = JSON.parse(localStorage.getItem(CHOICE_STORAGE_KEY) || "null");
    if (stored && typeof stored === "object") {
      for (const key of AUDIO_ALERT_KEYS) {
        choices[key] = stored[key] === 2 ? 2 : stored[key] === 1 ? 1 : 0;
      }
      return choices;
    }
  } catch {
    // Invalid local state falls through to legacy migration.
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (legacy && typeof legacy === "object") {
      for (const key of AUDIO_ALERT_KEYS) {
        if (legacy[key] === true) choices[key] = 1;
      }
    }
  } catch {
    // Invalid legacy state leaves every alert disabled.
  }

  return choices;
}

function settingsFromChoices(choices) {
  const settings = defaultAudioAlertSettings();
  for (const key of AUDIO_ALERT_KEYS) {
    settings[key] = choices[key] === 1 || choices[key] === 2;
  }
  return settings;
}

function alertChoiceMarkup(label, key, result) {
  const alertKey = `${key}_${result}`;
  return `
    <div class="alert-choice-pair" title="${label} ${result}">
      <label class="alert-choice" title="Sound 1">
        <input type="checkbox" data-audio-key="${alertKey}" data-audio-choice="1" aria-label="${label} ${result} sound 1">
        <span>1</span>
      </label>
      <label class="alert-choice" title="Sound 2">
        <input type="checkbox" data-audio-key="${alertKey}" data-audio-choice="2" aria-label="${label} ${result} sound 2">
        <span>2</span>
      </label>
    </div>`;
}

function alertRowsMarkup() {
  return ALERT_ROWS.map(({ label, className, key }) => `
    <span class="alert-name ${className}">${label}</span>
    ${alertChoiceMarkup(label, key, "captured")}
    ${alertChoiceMarkup(label, key, "fled")}`).join("");
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
  const choices = readChoices();
  const settings = settingsFromChoices(choices);
  const sound1Buffers = new Map();
  let sound2Buffer = null;
  let audioContext = null;
  let currentSource = null;
  let currentPlayback = null;
  let boundShadow = null;
  let gestureUnlockInstalled = false;
  let mountRetry = null;

  function writeChoices() {
    localStorage.setItem(CHOICE_STORAGE_KEY, JSON.stringify(choices));
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

  async function loadSound1Buffer(key) {
    if (sound1Buffers.has(key)) return sound1Buffers.get(key);
    const context = getAudioContext();
    const uri = AUDIO_URLS[key];
    if (!context || !uri) return null;

    const buffer = await context.decodeAudioData(dataUriToArrayBuffer(uri));
    sound1Buffers.set(key, buffer);
    return buffer;
  }

  async function loadSound2Buffer() {
    if (sound2Buffer) return sound2Buffer;
    const context = getAudioContext();
    if (!context) return null;
    sound2Buffer = await context.decodeAudioData(dataUriToArrayBuffer(SET2_SPRITE_URI));
    return sound2Buffer;
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
    currentPlayback = null;
  }

  async function playKey(key, choice = choices[key]) {
    const selected = Number(choice);
    if (selected !== 1 && selected !== 2) return false;
    if (!(await unlock())) return false;

    try {
      const context = getAudioContext();
      if (!context) return false;

      const useSound2 = selected === 2;
      const segment = useSound2 ? SET2_SEGMENTS[key] : null;
      const buffer = useSound2 ? await loadSound2Buffer() : await loadSound1Buffer(key);
      if (!buffer || (useSound2 && !segment)) return false;

      stopCurrent();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.addEventListener("ended", () => {
        if (currentSource !== source) return;
        source.disconnect();
        currentSource = null;
        currentPlayback = null;
      }, { once: true });
      currentSource = source;
      currentPlayback = `${key}:${selected}`;

      if (useSound2) {
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

  function syncChoicePair(shadow, key) {
    for (const checkbox of shadow.querySelectorAll(`[data-audio-key="${key}"]`)) {
      checkbox.checked = Number(checkbox.dataset.audioChoice) === choices[key];
    }
  }

  function bindControls(shadow) {
    boundShadow = shadow;

    for (const checkbox of shadow.querySelectorAll("[data-audio-key][data-audio-choice]")) {
      const key = checkbox.dataset.audioKey;
      const choice = Number(checkbox.dataset.audioChoice);
      if (!AUDIO_ALERT_KEYS.includes(key) || ![1, 2].includes(choice)) continue;

      checkbox.checked = choices[key] === choice;
      if (checkbox.dataset.audioBound === "true") continue;
      checkbox.dataset.audioBound = "true";

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          choices[key] = choice;
          settings[key] = true;
          syncChoicePair(shadow, key);
          writeChoices();
          updateEnabledCount();
          void playKey(key, choice);
          return;
        }

        if (choices[key] === choice) {
          choices[key] = 0;
          settings[key] = false;
          writeChoices();
          updateEnabledCount();
          if (currentPlayback === `${key}:${choice}`) stopCurrent();
        }
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
              <span id="alerts-enabled-count" class="section-badge">0/8</span>
            </div>
          </div>
          <div class="alert-grid">
            <span></span><b>Captured</b><b>Fled</b>
            ${alertRowsMarkup()}
          </div>
          <div class="alert-help">
            Choose sound 1 or 2 independently for each alert. Leave both unchecked to disable that alert.<br>
            Selecting a sound replaces the other option in the same pair and plays it once as preview. Shiny keeps priority over notable rarity when both apply.
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
    return key ? playKey(key, choices[key]) : false;
  }

  return {
    mountControls,
    handleTerminalAlert
  };
}
