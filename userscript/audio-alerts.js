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
import {
  createCustomAudioRepository,
  CUSTOM_AUDIO_MAX_BYTES,
  CUSTOM_AUDIO_MAX_DURATION_SECONDS
} from "./custom-audio-repository.js";

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
    grid-template-columns: minmax(95px, 1fr) 120px 120px;
    gap: 9px 7px;
    align-items: center;
    background: var(--bg-elevated);
  }

  .alert-grid > b {
    color: #9e9270;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .03em;
    text-align: left;
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
    position: relative;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 5px;
  }

  .alert-fled-heading,
  .alert-choice-pair-fled {
    padding-left: 10px;
    border-left: 1px solid var(--border-soft);
  }

  .alert-choice {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--muted);
    font-size: 8px;
    font-weight: 700;
    cursor: pointer;
  }

  .alert-choice input[type="checkbox"] {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--gold);
    cursor: pointer;
  }

  .alert-choice.custom-ready { color: var(--gold); }
  .alert-choice.custom-missing { color: #cf6868; }

  .custom-audio-manage {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--border-soft);
    border-radius: 3px;
    background: var(--bg);
    color: var(--muted);
    font-size: 10px;
    line-height: 16px;
    cursor: pointer;
  }

  .custom-audio-manage:hover {
    border-color: var(--gold);
    color: var(--gold);
  }

  .custom-audio-popover {
    position: absolute;
    z-index: 20;
    top: 22px;
    right: 0;
    min-width: 132px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-elevated);
    box-shadow: 0 4px 12px rgba(0, 0, 0, .35);
  }

  .custom-audio-file-name {
    display: block;
    max-width: 150px;
    margin-bottom: 5px;
    overflow: hidden;
    color: var(--muted);
    font-size: 8px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .custom-audio-actions {
    display: flex;
    gap: 5px;
  }

  .custom-audio-actions button {
    flex: 1;
    padding: 3px 5px;
    border: 1px solid var(--border-soft);
    border-radius: 3px;
    background: var(--bg);
    color: var(--text);
    font-size: 8px;
    cursor: pointer;
  }

  .custom-audio-actions button:hover { border-color: var(--gold); }
  .custom-audio-actions .custom-remove:hover { border-color: #cf6868; color: #cf6868; }

  .custom-audio-status {
    min-height: 12px;
    margin-top: 5px;
    color: var(--muted);
    font-size: 8px;
  }

  .custom-audio-status.error { color: #cf6868; }
  .custom-audio-status.ok { color: #72c98b; }

  .alert-help {
    padding: 8px 10px;
    border-top: 1px solid var(--border-soft);
    color: var(--muted);
    font-size: 9px;
    line-height: 1.35;
  }
`;

function normalizeChoice(value) {
  if (value === 1 || value === "1") return 1;
  if (value === 2 || value === "2") return 2;
  if (value === "custom") return "custom";
  return 0;
}

function readChoices() {
  const choices = Object.fromEntries(AUDIO_ALERT_KEYS.map((key) => [key, 0]));

  try {
    const stored = JSON.parse(localStorage.getItem(CHOICE_STORAGE_KEY) || "null");
    if (stored && typeof stored === "object") {
      for (const key of AUDIO_ALERT_KEYS) choices[key] = normalizeChoice(stored[key]);
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
  for (const key of AUDIO_ALERT_KEYS) settings[key] = choices[key] !== 0;
  return settings;
}

function alertChoiceMarkup(label, key, result) {
  const alertKey = `${key}_${result}`;
  return `
    <div class="alert-choice-pair alert-choice-pair-${result}" data-custom-pair="${alertKey}" title="${label} ${result}">
      <label class="alert-choice" title="Sound 1">
        <input type="checkbox" data-audio-key="${alertKey}" data-audio-choice="1" aria-label="${label} ${result} sound 1">
        <span>1</span>
      </label>
      <label class="alert-choice" title="Sound 2">
        <input type="checkbox" data-audio-key="${alertKey}" data-audio-choice="2" aria-label="${label} ${result} sound 2">
        <span>2</span>
      </label>
      <label class="alert-choice custom-choice" title="Custom sound">
        <input type="checkbox" data-audio-key="${alertKey}" data-audio-choice="custom" aria-label="${label} ${result} custom sound">
        <span>C</span>
      </label>
      <button class="custom-audio-manage" type="button" data-custom-manage="${alertKey}" title="Manage custom sound" hidden>⚙</button>
      <div class="custom-audio-popover" data-custom-popover="${alertKey}" hidden>
        <span class="custom-audio-file-name" data-custom-file-name="${alertKey}"></span>
        <div class="custom-audio-actions">
          <button type="button" data-custom-replace="${alertKey}">Replace</button>
          <button type="button" class="custom-remove" data-custom-remove="${alertKey}">Remove</button>
        </div>
      </div>
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
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function formatBytes(bytes) {
  return `${Math.ceil(bytes / 1024)} KB`;
}

export function createAudioAlerts() {
  const choices = readChoices();
  const settings = settingsFromChoices(choices);
  const sound1Buffers = new Map();
  const customBuffers = new Map();
  const customRecords = new Map();
  const customRepository = createCustomAudioRepository(window.indexedDB);
  let customStorageAvailable = true;
  let sound2Buffer = null;
  let audioContext = null;
  let currentSource = null;
  let currentPlayback = null;
  let boundShadow = null;
  let gestureUnlockInstalled = false;
  let mountRetry = null;
  let pendingCustomImport = null;

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

  async function loadCustomBuffer(key) {
    if (customBuffers.has(key)) return customBuffers.get(key);
    const context = getAudioContext();
    if (!context || !customStorageAvailable) return null;

    const record = customRecords.get(key) || await customRepository.get(key);
    if (!record?.data) {
      customRecords.delete(key);
      updateCustomSlot(boundShadow, key, null);
      return null;
    }

    const buffer = await context.decodeAudioData(record.data.slice(0));
    customRecords.set(key, record);
    customBuffers.set(key, buffer);
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
    currentPlayback = null;
  }

  async function playKey(key, choice = choices[key]) {
    const selected = normalizeChoice(choice);
    if (![1, 2, "custom"].includes(selected)) return false;
    if (!(await unlock())) return false;

    try {
      const context = getAudioContext();
      if (!context) return false;

      let buffer = null;
      let segment = null;
      if (selected === 1) buffer = await loadSound1Buffer(key);
      if (selected === 2) {
        segment = SET2_SEGMENTS[key];
        buffer = await loadSound2Buffer();
      }
      if (selected === "custom") buffer = await loadCustomBuffer(key);
      if (!buffer || (selected === 2 && !segment)) {
        if (selected === "custom") setCustomStatus("Custom sound is missing. Import it again.", true);
        return false;
      }

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

      if (selected === 2) source.start(0, segment.offset, segment.duration);
      else source.start();
      return true;
    } catch (error) {
      console.warn("PokePixel Hunt Analyzer (audio alert):", error);
      if (selected === "custom") setCustomStatus("Custom sound could not be decoded.", true);
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
    if (!shadow) return;
    for (const checkbox of shadow.querySelectorAll(`[data-audio-key="${key}"]`)) {
      checkbox.checked = normalizeChoice(checkbox.dataset.audioChoice) === choices[key];
    }
  }

  function setCustomStatus(message = "", isError = false) {
    const status = boundShadow?.getElementById("custom-audio-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", Boolean(message) && isError);
    status.classList.toggle("ok", Boolean(message) && !isError);
  }

  function closeCustomPopovers(shadow, exceptKey = null) {
    if (!shadow) return;
    for (const popover of shadow.querySelectorAll("[data-custom-popover]")) {
      if (popover.dataset.customPopover !== exceptKey) popover.hidden = true;
    }
  }

  function updateCustomSlot(shadow, key, record) {
    if (!shadow) return;
    if (record) customRecords.set(key, record);
    else customRecords.delete(key);

    const hasCustom = Boolean(record);
    const manage = shadow.querySelector(`[data-custom-manage="${key}"]`);
    const fileName = shadow.querySelector(`[data-custom-file-name="${key}"]`);
    const customInput = shadow.querySelector(`[data-audio-key="${key}"][data-audio-choice="custom"]`);
    const customLabel = customInput?.closest(".alert-choice");

    if (manage) manage.hidden = !hasCustom;
    if (fileName) fileName.textContent = hasCustom
      ? `${record.fileName || "Custom audio"} · ${formatBytes(record.size || record.data?.byteLength || 0)}`
      : "";
    if (customInput) customInput.disabled = !customStorageAvailable;
    customLabel?.classList.toggle("custom-ready", hasCustom);
    customLabel?.classList.toggle("custom-missing", choices[key] === "custom" && !hasCustom);
  }

  async function refreshCustomSlots(shadow) {
    try {
      const records = await customRepository.list();
      const byKey = new Map(records.map((record) => [record.key, record]));
      for (const key of AUDIO_ALERT_KEYS) updateCustomSlot(shadow, key, byKey.get(key) || null);
      customStorageAvailable = true;
    } catch (error) {
      customStorageAvailable = false;
      for (const key of AUDIO_ALERT_KEYS) updateCustomSlot(shadow, key, null);
      setCustomStatus("Custom audio storage is unavailable in this browser context.", true);
      console.warn("PokePixel Hunt Analyzer (custom audio storage):", error);
    }
  }

  function requestCustomImport(key) {
    if (!customStorageAvailable || !AUDIO_ALERT_KEYS.includes(key) || !boundShadow) return;
    pendingCustomImport = key;
    const input = boundShadow.getElementById("custom-audio-file-input");
    if (!input) return;
    input.value = "";
    input.click();
  }

  async function importCustomFile(key, file) {
    if (!file) return false;
    if (file.size > CUSTOM_AUDIO_MAX_BYTES) {
      setCustomStatus(`File too large. Maximum is ${CUSTOM_AUDIO_MAX_BYTES / 1024 / 1024} MB.`, true);
      return false;
    }

    const context = getAudioContext();
    if (!context) {
      setCustomStatus("Web Audio is unavailable in this browser.", true);
      return false;
    }

    try {
      const data = await file.arrayBuffer();
      const decoded = await context.decodeAudioData(data.slice(0));
      if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) throw new Error("Invalid audio duration");
      if (decoded.duration > CUSTOM_AUDIO_MAX_DURATION_SECONDS) {
        setCustomStatus(`Audio too long. Maximum is ${CUSTOM_AUDIO_MAX_DURATION_SECONDS} seconds.`, true);
        return false;
      }

      const record = {
        key,
        fileName: file.name || "custom-audio",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        duration: decoded.duration,
        data,
        createdAt: Date.now()
      };

      await customRepository.put(record);
      customBuffers.set(key, decoded);
      updateCustomSlot(boundShadow, key, record);
      choices[key] = "custom";
      settings[key] = true;
      syncChoicePair(boundShadow, key);
      writeChoices();
      updateEnabledCount();
      closeCustomPopovers(boundShadow);
      setCustomStatus(`${record.fileName} imported for ${key.replace("_", " ")}.`);
      await playKey(key, "custom");
      return true;
    } catch (error) {
      console.warn("PokePixel Hunt Analyzer (custom audio import):", error);
      setCustomStatus("Unsupported or invalid audio. Use MP3, WAV or OGG/Opus.", true);
      return false;
    }
  }

  async function removeCustom(key) {
    try {
      await customRepository.remove(key);
      customBuffers.delete(key);
      updateCustomSlot(boundShadow, key, null);
      if (choices[key] === "custom") {
        choices[key] = 0;
        settings[key] = false;
        syncChoicePair(boundShadow, key);
        writeChoices();
        updateEnabledCount();
      }
      if (currentPlayback === `${key}:custom`) stopCurrent();
      closeCustomPopovers(boundShadow);
      setCustomStatus(`Custom sound removed from ${key.replace("_", " ")}.`);
    } catch (error) {
      console.warn("PokePixel Hunt Analyzer (custom audio remove):", error);
      setCustomStatus("Custom sound could not be removed.", true);
    }
  }

  function bindControls(shadow) {
    boundShadow = shadow;

    for (const checkbox of shadow.querySelectorAll("[data-audio-key][data-audio-choice]")) {
      const key = checkbox.dataset.audioKey;
      const choice = normalizeChoice(checkbox.dataset.audioChoice);
      if (!AUDIO_ALERT_KEYS.includes(key) || ![1, 2, "custom"].includes(choice)) continue;

      checkbox.checked = choices[key] === choice;
      if (checkbox.dataset.audioBound === "true") continue;
      checkbox.dataset.audioBound = "true";

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          if (choice === "custom" && !customRecords.has(key)) {
            checkbox.checked = false;
            requestCustomImport(key);
            return;
          }

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

    for (const button of shadow.querySelectorAll("[data-custom-manage]")) {
      if (button.dataset.customBound === "true") continue;
      button.dataset.customBound = "true";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const key = button.dataset.customManage;
        const popover = shadow.querySelector(`[data-custom-popover="${key}"]`);
        const willOpen = Boolean(popover?.hidden);
        closeCustomPopovers(shadow, willOpen ? key : null);
        if (popover) popover.hidden = !willOpen;
      });
    }

    for (const button of shadow.querySelectorAll("[data-custom-replace]")) {
      if (button.dataset.customBound === "true") continue;
      button.dataset.customBound = "true";
      button.addEventListener("click", () => requestCustomImport(button.dataset.customReplace));
    }

    for (const button of shadow.querySelectorAll("[data-custom-remove]")) {
      if (button.dataset.customBound === "true") continue;
      button.dataset.customBound = "true";
      button.addEventListener("click", () => void removeCustom(button.dataset.customRemove));
    }

    const fileInput = shadow.getElementById("custom-audio-file-input");
    if (fileInput && fileInput.dataset.customBound !== "true") {
      fileInput.dataset.customBound = "true";
      fileInput.addEventListener("change", () => {
        const key = pendingCustomImport;
        const file = fileInput.files?.[0] || null;
        pendingCustomImport = null;
        if (key && file) void importCustomFile(key, file);
      });
    }

    shadow.addEventListener("click", (event) => {
      if (!event.target.closest(".alert-choice-pair")) closeCustomPopovers(shadow);
    });

    updateEnabledCount();
    installGestureUnlock();
    void refreshCustomSlots(shadow);
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
    closeCustomPopovers(shadow);
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
            <span></span><b>Captured</b><b class="alert-fled-heading">Fled</b>
            ${alertRowsMarkup()}
          </div>
          <input id="custom-audio-file-input" type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/opus" hidden>
          <div class="alert-help">
            Choose 1, 2 or C independently for each alert. C imports one local custom sound for that exact Rarity + Status slot.<br>
            Importing again replaces the previous custom file in that slot. Custom audio stays only in this browser (max 2 MB / 10 s). Shiny keeps priority when both rules apply.
            <div id="custom-audio-status" class="custom-audio-status"></div>
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
