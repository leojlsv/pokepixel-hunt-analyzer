import { createAudioAlerts as createBaseAudioAlerts } from "./audio-alerts.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const MUTE_STORAGE_KEY = "pokepixel_hunt_analyzer_audio_muted_v1";
const MUTE_BUTTON_ID = "alerts-mute-toggle";
const MUTE_STYLE_ID = "pha-audio-mute-style";

const SPEAKER_ON = `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2 6h3l4-3v10l-4-3H2V6Z" fill="currentColor"/>
    <path d="M11 5.2c1 .8 1.5 1.7 1.5 2.8S12 10 11 10.8M12.6 3.7C14.2 4.9 15 6.3 15 8s-.8 3.1-2.4 4.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`;

const SPEAKER_OFF = `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2 6h3l4-3v10l-4-3H2V6Z" fill="currentColor"/>
    <path d="m11 6 4 4m0-4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;

const MUTE_STYLE = `
  .alerts-mute-toggle {
    width:24px;
    height:20px;
    padding:0;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    border:1px solid var(--border-soft);
    border-radius:3px;
    background:var(--bg);
    color:var(--muted);
    cursor:pointer;
  }
  .alerts-mute-toggle:hover {
    border-color:var(--gold);
    color:var(--gold);
  }
  .alerts-mute-toggle.muted {
    border-color:#6b4141;
    color:#cf6868;
  }
  .alerts-mute-toggle svg {
    width:12px;
    height:12px;
    display:block;
  }
`;

function readMuted() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Mute still works for this page even when storage is unavailable.
  }
}

export function createAudioAlerts() {
  const alerts = createBaseAudioAlerts();
  let muted = readMuted();
  let mountRetry = null;

  function syncMuteButton(shadow) {
    const button = shadow?.getElementById(MUTE_BUTTON_ID);
    if (!button) return;
    button.classList.toggle("muted", muted);
    button.setAttribute("aria-pressed", muted ? "true" : "false");
    button.setAttribute("aria-label", muted ? "Unmute sound alerts" : "Mute all sound alerts");
    button.title = muted ? "Unmute sound alerts" : "Mute all sound alerts";
    button.innerHTML = muted ? SPEAKER_OFF : SPEAKER_ON;
  }

  function ensureMuteControl() {
    const shadow = document.getElementById(ROOT_ID)?.shadowRoot;
    const meta = shadow?.querySelector("#view-alerts .section-head .section-meta");
    if (!shadow || !meta) return false;

    if (!shadow.getElementById(MUTE_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = MUTE_STYLE_ID;
      style.textContent = MUTE_STYLE;
      shadow.appendChild(style);
    }

    let button = shadow.getElementById(MUTE_BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = MUTE_BUTTON_ID;
      button.className = "alerts-mute-toggle";
      button.type = "button";
      button.addEventListener("click", () => {
        muted = !muted;
        writeMuted(muted);
        syncMuteButton(shadow);
      });
      const collapseButton = meta.querySelector(".alert-collapse");
      if (collapseButton) collapseButton.before(button);
      else meta.appendChild(button);
    }

    syncMuteButton(shadow);
    return true;
  }

  function mountControls() {
    const mounted = alerts.mountControls();
    if (mounted && ensureMuteControl()) return true;

    if (!mountRetry) {
      mountRetry = window.setTimeout(() => {
        mountRetry = null;
        mountControls();
      }, 50);
    }
    return mounted;
  }

  async function handleTerminalAlert(alert) {
    if (muted) return false;
    return alerts.handleTerminalAlert(alert);
  }

  return {
    mountControls,
    handleTerminalAlert,
    isMuted: () => muted
  };
}
