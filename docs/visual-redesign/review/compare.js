(() => {
  "use strict";
  const SIZES = Object.freeze({
    "desktop-415": { width: 415, height: 700, x: -300, y: -25 },
    "desktop-620": { width: 620, height: 700, x: -300, y: -25 },
    "mobile-320": { width: 320, height: 568, x: 0, y: 0 },
    "mobile-390": { width: 390, height: 844, x: 0, y: 0 }
  });
  const NOTES = Object.freeze({
    current: ["Current · densidade para Discord", "KPIs XP/economia organizados por espaço; Captured/Failed sem Level. Captured distribui metadados e seis IVs em duas faixas por linha, sob cabeçalho compartilhado, sem boxes por Pokémon nem scroll horizontal."],
    history: ["History · tabelas contínuas", "Hunts, Pokémon e Attempts mantêm campos completos, cabeçalhos visíveis e linhas compactas. O nível permanece em History Pokémon. Controles de filtros e ordenação ficam recolhidos no layout estreito."],
    misc: ["Misc · configurações e galeria", "Sound Alerts, Interface e Catch Gallery ficam em seções legíveis. Os dados da Gallery se organizam em linhas contínuas com timestamp completo e ações visíveis; áudio, Delete, Generate e Copy exigem validação no runtime real."],
    hud: ["HUD · modos e widgets", "A proposta mantém presets, slots e apresentação do launcher. Conferir Default com Rarity Tracker ocupando dois slots, One Column e PX Only no protótipo interativo."]
  });
  let size = "desktop-415";
  let screen = "current";
  const pane = document.getElementById("pair");
  const source = document.getElementById("source-image");
  const proposal = document.getElementById("proposal-image");
  function render() {
    const preset = SIZES[size];
    pane.style.setProperty("--frame-width", `${preset.width}px`);
    pane.style.setProperty("--frame-height", `${preset.height}px`);
    pane.style.setProperty("--source-x", `${preset.x}px`);
    pane.style.setProperty("--source-y", `${preset.y}px`);
    source.src = `../reference/screenshots/${size}-${screen}.png`;
    proposal.src = `./screenshots/${size}-${screen}.png`;
    for (const button of document.querySelectorAll("[data-size]")) {
      button.setAttribute("aria-pressed", String(button.dataset.size === size));
    }
    for (const button of document.querySelectorAll("[data-screen]")) {
      button.setAttribute("aria-pressed", String(button.dataset.screen === screen));
    }
    document.getElementById("notes-title").textContent = NOTES[screen][0];
    document.getElementById("notes-text").textContent = NOTES[screen][1];
  }
  document.getElementById("size-controls").addEventListener("click", (event) => {
    const next = event.target.closest("[data-size]")?.dataset.size;
    if (!SIZES[next]) return;
    size = next;
    render();
  });
  document.getElementById("view-controls").addEventListener("click", (event) => {
    const next = event.target.closest("[data-screen]")?.dataset.screen;
    if (!NOTES[next]) return;
    screen = next;
    render();
  });
  const params = new URLSearchParams(window.location.search);
  if (SIZES[params.get("size")]) size = params.get("size");
  if (NOTES[params.get("screen")]) screen = params.get("screen");
  render();
})();
