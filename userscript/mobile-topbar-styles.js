export const MOBILE_TOPBAR_STYLES = String.raw`
:host([data-ui-mode="mobile"]) .pha-hud-topbar {
  min-height: 0;
  padding: 7px 8px 6px;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  grid-template-rows: minmax(40px, auto) 30px;
  column-gap: 6px;
  row-gap: 3px;
  align-items: center;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar .brand {
  display: contents;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar .brand > strong {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  align-self: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar .brand-meta {
  grid-column: 1 / 4;
  grid-row: 2;
  min-width: 0;
  max-width: 100%;
  gap: 3px;
  overflow: hidden;
  white-space: nowrap;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar .brand-meta > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar .refcode,
:host([data-ui-mode="mobile"]) .pha-hud-topbar .pha-ui-mode-select {
  flex: 0 0 auto;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar #pha-hud-settings-button {
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar #pha-alpha {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar #pha-close {
  grid-column: 4;
  grid-row: 1;
  justify-self: end;
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar #pha-tab-state {
  grid-column: 4;
  grid-row: 2;
  justify-self: end;
  align-self: center;
  white-space: nowrap;
}
`;
