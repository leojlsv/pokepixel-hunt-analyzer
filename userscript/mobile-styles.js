export const MOBILE_STYLES = String.raw`
.pha-ui-mode-select {
  height: 18px;
  max-width: 62px;
  padding: 0 2px;
  border: 1px solid #4b4a43;
  border-radius: 3px;
  background: #20211e;
  color: #aaa79c;
  font-size: 8px;
  line-height: 1;
}

:host([data-ui-mode="mobile"]) {
  --pha-safe-top: env(safe-area-inset-top, 0px);
  --pha-safe-right: env(safe-area-inset-right, 0px);
  --pha-safe-bottom: env(safe-area-inset-bottom, 0px);
  --pha-safe-left: env(safe-area-inset-left, 0px);
}

:host([data-ui-mode="mobile"]) .panel {
  position: fixed !important;
  inset: 0 auto auto 0 !important;
  width: 100vw !important;
  min-width: 0 !important;
  max-width: none !important;
  height: 100vh !important;
  height: 100dvh !important;
  min-height: 0 !important;
  max-height: none !important;
  padding: var(--pha-safe-top) var(--pha-safe-right) var(--pha-safe-bottom) var(--pha-safe-left);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  resize: none;
  border-radius: 0;
  scrollbar-gutter: auto;
}

:host([data-ui-mode="mobile"]) .panel[hidden] {
  display: none !important;
}

:host([data-ui-mode="mobile"]) .topbar {
  position: relative;
  top: auto;
  flex: 0 0 auto;
  cursor: default;
  touch-action: auto;
}

:host([data-ui-mode="mobile"]) .tabs {
  position: relative;
  top: auto;
  flex: 0 0 auto;
}

:host([data-ui-mode="mobile"]) .view {
  min-height: 0;
  flex: 1 1 auto;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

:host([data-ui-mode="mobile"]) .current-view,
:host([data-ui-mode="mobile"]) .history-view {
  min-width: 0;
}

:host([data-ui-mode="mobile"]) .resize-bottom-left {
  display: none !important;
}

:host([data-ui-mode="mobile"]) .launcher {
  right: calc(8px + var(--pha-safe-right));
  bottom: calc(8px + var(--pha-safe-bottom));
}
`;
