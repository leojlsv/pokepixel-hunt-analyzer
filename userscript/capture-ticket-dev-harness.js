import { openCaptureTicketPreview } from "./capture-ticket.js";

const HARNESS_ID = "capture-ticket-dev-harness";
const SAMPLE_CAPTURE_AT_MS = new Date("2026-08-24T08:21:55-03:00").getTime();

function sampleEncounter(theme) {
  return {
    encounterId: `dev-ticket-${theme}`,
    captureResult: "success",
    speciesName: "Charizard",
    quality: theme === "mythic" ? "mythical" : theme === "legend" ? "legendary" : "common",
    qualityMultiplier: 1.72,
    ivTotal: 189,
    isShiny: theme === "shiny",
    capturedByName: "Rhyxus",
    captureAtMs: SAMPLE_CAPTURE_AT_MS
  };
}

export function mountCaptureTicketDevHarness(shadow) {
  shadow.getElementById(HARNESS_ID)?.remove();
  const alertsView = shadow.getElementById("view-alerts");
  if (!alertsView) return () => {};

  const section = document.createElement("section");
  section.id = HARNESS_ID;
  section.style.cssText = "padding:8px 10px;border:1px dashed #665d45;background:#25251f;";

  const label = document.createElement("div");
  label.textContent = "DEV · Capture Ticket Preview";
  label.style.cssText = "margin-bottom:6px;color:#c0ad72;font:700 9px Arial,sans-serif;text-transform:uppercase;letter-spacing:.03em;";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:6px;align-items:center;";

  for (const [theme, text] of [["legend", "Legend"], ["mythic", "Mythic"], ["shiny", "Shiny"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.style.cssText = "padding:4px 7px;border:1px solid #58594f;border-radius:3px;background:#2d2e29;color:#ddd;font:9px Arial,sans-serif;cursor:pointer;";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await openCaptureTicketPreview(sampleEncounter(theme));
      } catch (error) {
        console.error("PokePixel Hunt Analyzer (Capture Ticket DEV):", error);
        button.title = error?.message || "Capture Ticket preview failed";
      } finally {
        button.disabled = false;
      }
    });
    actions.appendChild(button);
  }

  const note = document.createElement("span");
  note.textContent = "Temporary; remove before release";
  note.style.cssText = "margin-left:auto;color:#817d70;font:8px Arial,sans-serif;";
  actions.appendChild(note);

  section.append(label, actions);
  alertsView.appendChild(section);

  return () => section.remove();
}
