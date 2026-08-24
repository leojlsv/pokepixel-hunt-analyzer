const ROOT_ID = "pokepixel-hunt-analyzer-root";
const HUNTS_BODY_ID = "history-hunts-body";
const PERIOD_FILTER_ID = "history-period";
const STYLE_ID = "pha-history-delete-styles";

const STYLES = `
  .history-delete-footer {
    margin-top:7px;
    padding-top:6px;
    display:flex;
    justify-content:flex-end;
    border-top:1px solid #3a3a34;
  }
  .history-delete-button {
    height:21px;
    min-width:56px;
    padding:0 8px;
    border:1px solid #7a4542;
    border-radius:3px;
    background:#332321;
    color:#ef8b82;
    font-size:9px;
    font-weight:800;
    letter-spacing:.035em;
    line-height:19px;
    cursor:pointer;
  }
  .history-delete-button:hover:not(:disabled) {
    border-color:#b45f59;
    background:#432824;
    color:#ffaaa2;
  }
  .history-delete-button:disabled {
    cursor:default;
    opacity:.55;
  }
`;

function confirmationText(huntRow) {
  const label = huntRow?.cells?.[0]?.textContent?.trim();
  return [
    `Delete ${label ? `Hunt ${label}` : "this Hunt"} and all of its stored encounters?`,
    "",
    "This cannot be undone."
  ].join("\n");
}

export function createHistoryDeleteControl({ onDeleteSession }) {
  if (typeof onDeleteSession !== "function") {
    throw new TypeError("createHistoryDeleteControl: onDeleteSession is required");
  }

  let shadow = null;
  let body = null;
  let observer = null;
  let disposed = false;

  function requestHistoryRefresh() {
    const period = shadow?.getElementById(PERIOD_FILTER_ID);
    period?.dispatchEvent(new Event("change"));
  }

  function createButton(sessionId, huntRow) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-delete-button";
    button.textContent = "DELETE";
    button.title = "Delete this Hunt and all of its stored encounters";

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      if (!window.confirm(confirmationText(huntRow))) return;

      const original = button.textContent;
      button.disabled = true;
      button.textContent = "DELETING…";

      try {
        await onDeleteSession(sessionId);
        if (disposed) return;
        button.textContent = "DELETED";
        requestHistoryRefresh();
      } catch (error) {
        console.error("PokePixel Hunt Analyzer (History delete):", error);
        button.title = error?.message || "Could not delete Hunt";
        button.textContent = "ERROR";
        window.setTimeout(() => {
          if (!button.isConnected) return;
          button.textContent = original;
          button.disabled = false;
        }, 1600);
      }
    });

    return button;
  }

  function syncButtons() {
    if (disposed || !body) return;

    for (const detailRow of body.querySelectorAll(".history-detail-row")) {
      if (detailRow.querySelector(".history-delete-footer")) continue;

      const huntRow = detailRow.previousElementSibling;
      const sessionId = huntRow?.dataset?.sessionId;
      const cell = detailRow.querySelector("td");
      if (!sessionId || !cell) continue;

      const footer = document.createElement("div");
      footer.className = "history-delete-footer";
      footer.appendChild(createButton(sessionId, huntRow));
      cell.appendChild(footer);
    }
  }

  function mount() {
    dispose();
    disposed = false;
    shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
    body = shadow?.getElementById(HUNTS_BODY_ID) || null;
    if (!shadow || !body) return false;

    if (!shadow.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = STYLES;
      shadow.appendChild(style);
    }

    observer = new MutationObserver(syncButtons);
    observer.observe(body, { childList: true, subtree: true });
    syncButtons();
    return true;
  }

  function dispose() {
    disposed = true;
    observer?.disconnect();
    observer = null;
    body = null;
    shadow = null;
  }

  return { mount, dispose };
}
