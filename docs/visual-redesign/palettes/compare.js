"use strict";

// Static, local screenshot selector. No fetch, gameplay events or persistence.
const options = Object.freeze({
  baseline: Object.freeze({ obsidian: "Obsidiana" }),
  palette: Object.freeze({
    amethyst: "Ametista Noturna", titanium: "Titânio", copper: "Cobre Vulcânico"
  }),
  size: Object.freeze({
    "desktop-415": "Desktop 415", "desktop-620": "Desktop 620",
    "mobile-320": "Mobile 320", "mobile-390": "Mobile 390"
  }),
  screen: Object.freeze({
    current: "Current", history: "History", misc: "Misc", hud: "Configuração HUD",
    "hud-2": "HUD 2 col.", "hud-1": "HUD 1 col.", "hud-0": "PX-only"
  })
});
const query = new URLSearchParams(location.search);
const selected = {
  baseline: Object.hasOwn(options.baseline, query.get("baseline")) ? query.get("baseline") : "obsidian",
  palette: Object.hasOwn(options.palette, query.get("palette")) ? query.get("palette") : "amethyst",
  size: Object.hasOwn(options.size, query.get("size")) ? query.get("size") : "desktop-415",
  screen: Object.hasOwn(options.screen, query.get("screen")) ? query.get("screen") : "current"
};
const samples = {
  obsidian: ["#171c23", "#222a33", "#ebf3fa", "#8cbcff"],
  amethyst: ["#1d1a29", "#2a263a", "#f1edff", "#c6a8ff"],
  titanium: ["#191d23", "#272d35", "#eff3f7", "#c2d6e9"],
  copper: ["#211c1b", "#312924", "#f5eee8", "#e9b48d"]
};

function updateSwatches(container, palette) {
  container.replaceChildren();
  for (const color of samples[palette]) {
    const tile = document.createElement("i");
    tile.style.backgroundColor = color;
    tile.title = color;
    container.appendChild(tile);
  }
}

function referenceUrl(palette) {
  const url = new URL("../reference/index.html", location.href);
  const columns = selected.screen.startsWith("hud-") ? selected.screen.slice(-1) : null;
  url.searchParams.set("mode", selected.size.startsWith("mobile") ? "mobile" : "desktop");
  url.searchParams.set("view", columns === null ? selected.screen : "current");
  if (selected.size === "desktop-415") url.searchParams.set("panel", "415");
  url.searchParams.set("palette", palette);
  url.searchParams.set("now", String(Date.parse("2026-09-30T12:00:00Z")));
  url.searchParams.set("hudFixture", "dense");
  if (columns !== null) {
    url.searchParams.set("showLauncher", "1");
    url.searchParams.set("hudColumns", columns);
  }
  return url.href;
}

function render() {
  const name = selected.size + "-" + selected.screen + ".png";
  const compact = selected.screen.startsWith("hud-");
  const baseline = document.getElementById("shot-baseline");
  const candidate = document.getElementById("shot-candidate");
  baseline.src = "./screenshots/" + selected.baseline + "/" + name;
  candidate.src = "./screenshots/" + selected.palette + "/" + name;
  baseline.classList.toggle("compact", compact);
  candidate.classList.toggle("compact", compact);
  baseline.alt = "Analyzer " + options.baseline[selected.baseline] + " · " + options.screen[selected.screen] + " · " + options.size[selected.size];
  candidate.alt = "Analyzer " + options.palette[selected.palette] + " · " + options.screen[selected.screen] + " · " + options.size[selected.size];
  document.getElementById("baseline-title").textContent = options.baseline[selected.baseline];
  document.getElementById("candidate-title").textContent = options.palette[selected.palette];
  document.getElementById("summary").textContent = options.baseline[selected.baseline] + " × " + options.palette[selected.palette]
    + " · " + options.screen[selected.screen] + " · " + options.size[selected.size];
  updateSwatches(document.getElementById("swatches-baseline"), selected.baseline);
  updateSwatches(document.getElementById("swatches-candidate"), selected.palette);
  document.getElementById("live-baseline").href = referenceUrl(selected.baseline);
  document.getElementById("live-candidate").href = referenceUrl(selected.palette);
  for (const kind of ["baseline", "palette", "screen", "size"]) {
    document.querySelectorAll("[data-" + kind + "]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset[kind] === selected[kind]));
    });
  }
}

for (const kind of ["baseline", "palette", "screen", "size"]) {
  document.querySelectorAll("[data-" + kind + "]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset[kind];
      if (!Object.hasOwn(options[kind], value)) return;
      selected[kind] = value;
      render();
    });
  });
}

for (const image of document.querySelectorAll(".shot")) {
  image.addEventListener("error", () => {
    document.getElementById("summary").textContent = "Imagem não encontrada. Gere as capturas conforme README.md.";
  });
}
render();
