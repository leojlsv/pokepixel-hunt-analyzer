const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STATUSBAR_ID = "pha-mobile-statusbar";
const MISC_TAB_ID = "alerts-tab";
const HUD_TAB_ID = "pha-hud-settings-button";
const MAX_BIND_ATTEMPTS = 200;

export const MOBILE_BOTTOM_NAV_STYLES = String.raw`
:host([data-ui-mode="mobile"]) .pha-mobile-statusbar {
  min-height: 32px;
  padding: 4px 8px;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-elevated);
}

:host([data-ui-mode="mobile"]) .pha-mobile-statusbar .hunt-time {
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 1;
}

:host([data-ui-mode="mobile"]) .pha-mobile-statusbar #pha-tab-state {
  flex: 0 0 auto;
  padding: 3px 5px;
  font-size: 8px;
  line-height: 1;
  white-space: nowrap;
}

:host([data-ui-mode="mobile"]) .tabs {
  position: sticky;
  z-index: 50;
  bottom: 0;
  width: 100%;
  min-height: 54px;
  padding: 5px 6px;
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  flex: 0 0 auto;
  gap: 4px;
  border-top: 1px solid var(--border);
  border-bottom: 0;
  background: var(--bg-elevated);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, .24);
}

:host([data-ui-mode="mobile"]) .tabs .tab {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 6px 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 10px;
  text-align: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .tabs .tab.active {
  border-color: var(--gold-soft);
  background: #35342d;
  color: var(--gold);
}

:host([data-ui-mode="mobile"]) .tabs .tab:active {
  background: #3d3c34;
}
`;

export function mountMobileBottomNav(shadow) {
  if (!shadow || shadow.host?.dataset.uiMode !== "mobile") return false;

  const panel = shadow.getElementById("pha-panel");
  const topbar = shadow.querySelector(".topbar");
  const tabs = shadow.querySelector(".tabs");
  const huntTime = shadow.getElementById("hunt-time");
  const state = shadow.getElementById("pha-tab-state");
  const miscTab = shadow.getElementById(MISC_TAB_ID);
  const hudTab = shadow.getElementById(HUD_TAB_ID);
  if (!panel || !topbar || !tabs || !huntTime || !state || !miscTab || !hudTab) return false;

  let statusbar = shadow.getElementById(STATUSBAR_ID);
  if (!statusbar) {
    statusbar = document.createElement("div");
    statusbar.id = STATUSBAR_ID;
    statusbar.className = "pha-mobile-statusbar";
    statusbar.setAttribute("aria-label", "Hunt status");
  }

  if (topbar.nextElementSibling !== statusbar) topbar.after(statusbar);
  if (huntTime.parentElement !== statusbar) statusbar.appendChild(huntTime);
  if (state.parentElement !== statusbar || huntTime.nextElementSibling !== state) {
    huntTime.after(state);
  }

  if (panel.lastElementChild !== tabs) panel.appendChild(tabs);
  tabs.setAttribute("aria-label", "Analyzer navigation");
  return true;
}

function bindWhenReady(attempt = 0) {
  if (typeof document === "undefined") return;
  const shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
  if (mountMobileBottomNav(shadow)) return;
  if (attempt >= MAX_BIND_ATTEMPTS) return;
  setTimeout(() => bindWhenReady(attempt + 1), 50);
}

if (typeof document !== "undefined") {
  queueMicrotask(() => bindWhenReady());
}
