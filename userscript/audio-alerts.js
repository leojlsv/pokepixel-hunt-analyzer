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

const STORAGE_KEY = "pokepixel_hunt_analyzer_audio_alerts_v1";

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
    bindControls,
    handleTerminalAlert
  };
}
