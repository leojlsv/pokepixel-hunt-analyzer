import {
  buildCaptureTicketData,
  canGenerateCaptureTicket,
  resolveCaptureTicketTheme
} from "../domain/captureTicket.js";
import { formatCaptureTimestamp } from "./encounter-list-model.js";
import { loadRemoteImage } from "./remote-image-loader.js";
import { canvasToPngBlobWithMetadata } from "./png-metadata.js";
import shinyBackpaper from "./capture-ticket-assets/shiny_backpaper.png";
import shinyFrame from "./capture-ticket-assets/shiny_ticket_frame.png";
import legendBackpaper from "./capture-ticket-assets/legend_backpaper.png";
import legendFrame from "./capture-ticket-assets/legend_ticket_frame.png";
import mythicBackpaper from "./capture-ticket-assets/mythic_backpaper.png";
import mythicFrame from "./capture-ticket-assets/mythic_ticket_frame.png";

export const TICKET_LAYOUT = Object.freeze({
  canvas: { width: 303, height: 500 },
  sprite: { x: 151.5, y: 251.5, width: 192, height: 192, zoom: 1 },
  pokemonName: {
    x: 151.5,
    y: 103.5,
    fontPt: 18.6,
    maxWidth: 200,
    textAlign: "center",
    strokeWidth: 3,
    overflow: "fit"
  },
  qualityLine: {
    x: 151.5,
    y: 405.5,
    fontPt: 6.6,
    maxWidth: 180,
    textAlign: "center",
    overflow: "clip"
  },
  capturedBy: {
    x: 151.5,
    y: 429.5,
    fontPt: 7,
    maxWidth: 180,
    textAlign: "center",
    overflow: "clip"
  },
  timestamp: {
    x: 151.5,
    y: 453.5,
    fontPt: 6.6,
    maxWidth: 180,
    textAlign: "center",
    overflow: "clip"
  }
});

const THEMES = Object.freeze({
  legend: {
    nameFill: "#ffffff",
    nameStroke: "#fe9b5e",
    dataFill: "#5f3e23",
    backpaper: legendBackpaper,
    frame: legendFrame,
    frameSha256: "bc97487687979a502333460bb774075820856106f224e8e20c67fd6c09d52d39"
  },
  mythic: {
    nameFill: "#ffffff",
    nameStroke: "#ff9090",
    dataFill: "#5f3e23",
    backpaper: mythicBackpaper,
    frame: mythicFrame,
    frameSha256: "b91f352cdb81173493073d9d3baa5e2d0ac50d1885d4947aa836ee2ccae15db0"
  },
  shiny: {
    nameFill: "#ffffff",
    nameStroke: "#7157a8",
    dataFill: "#412470",
    backpaper: shinyBackpaper,
    frame: shinyFrame,
    frameSha256: "045755f30f7e5b19e40a9b40cd08cac22e1b617bb57ad922929176d6d39a5d31"
  }
});

const GOOGLE_FONT_URL = "https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap";
const FONT_LINK_ID = "pha-capture-ticket-silkscreen";
const PREVIEW_HOST_ID = "pha-capture-ticket-preview";
const FRAME_FINGERPRINT = "rhyxus.pp-prize-ticket.v1";

function ptToPx(points) {
  return points * 96 / 72;
}

let fontReadyPromise = null;

async function ensureFont() {
  if (!document.fonts) return;

  if (document.fonts.check('6px "Silkscreen"')) {
    return;
  }

  if (!fontReadyPromise) {
    fontReadyPromise = new Promise((resolve, reject) => {
      let settled = false;
      let link = document.getElementById(FONT_LINK_ID);

      const finishResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const finishReject = (error) => {
        if (settled) return;
        settled = true;
        fontReadyPromise = null;
        reject(error);
      };

      const loadFace = async () => {
        try {
          await Promise.race([
            document.fonts.load('6px "Silkscreen"'),
            new Promise((_, rejectLoad) =>
              setTimeout(() => rejectLoad(new Error("Silkscreen font load timed out")), 6000)
            )
          ]);

          await Promise.race([
            document.fonts.ready,
            new Promise((_, rejectReady) =>
              setTimeout(() => rejectReady(new Error("Silkscreen fonts.ready timed out")), 6000)
            )
          ]);

          if (!document.fonts.check('6px "Silkscreen"')) {
            throw new Error("Silkscreen font unavailable after load");
          }

          finishResolve();
        } catch (error) {
          finishReject(error);
        }
      };

      if (!link) {
        link = document.createElement("link");
        link.id = FONT_LINK_ID;
        link.rel = "stylesheet";
        link.href = GOOGLE_FONT_URL;
        link.addEventListener("load", () => {
          void loadFace();
        }, { once: true });
        link.addEventListener("error", () => {
          finishReject(new Error("Silkscreen stylesheet failed to load"));
        }, { once: true });
        (document.head || document.documentElement).appendChild(link);
      } else {
        void loadFace();
      }
    });
  }

  return fontReadyPromise;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${url}`));
    image.src = url;
  });
}

function setFont(ctx, px) {
  ctx.font = `${px}px Silkscreen, monospace`;
  ctx.textBaseline = "middle";
}

function fitFontSize(ctx, text, config) {
  let px = ptToPx(config.fontPt);
  setFont(ctx, px);
  if (config.overflow !== "fit") return px;

  while (px > 1 && ctx.measureText(text).width > config.maxWidth) {
    px -= 0.1;
    setFont(ctx, px);
  }
  return px;
}

function drawText(ctx, text, config, { fill, stroke = null } = {}) {
  ctx.save();
  ctx.textAlign = config.textAlign || "center";
  const px = fitFontSize(ctx, text, config);
  setFont(ctx, px);

  if (config.overflow === "clip") {
    const clipHeight = Math.max(12, px * 3);
    ctx.beginPath();
    ctx.rect(
      config.x - config.maxWidth / 2,
      config.y - clipHeight / 2,
      config.maxWidth,
      clipHeight
    );
    ctx.clip();
  }

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = config.strokeWidth || 1;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(text, config.x, config.y);
  }

  ctx.fillStyle = fill;
  ctx.fillText(text, config.x, config.y);
  ctx.restore();
}

function drawPokemonSprite(ctx, image, layout) {
  const sourceWidth = Number(image.naturalWidth || image.width);
  const sourceHeight = Number(image.naturalHeight || image.height);
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
    throw new Error("Capture ticket Pokémon sprite has invalid dimensions");
  }

  const zoom = Number.isFinite(layout.zoom) ? layout.zoom : 1;
  const width = Math.max(1, Math.round(sourceWidth * zoom));
  const height = Math.max(1, Math.round(sourceHeight * zoom));
  const areaLeft = Math.round(layout.x - layout.width / 2);
  const areaTop = Math.round(layout.y - layout.height / 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(areaLeft, areaTop, layout.width, layout.height);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    image,
    Math.round(layout.x - width / 2),
    Math.round(layout.y - height / 2),
    width,
    height
  );
  ctx.restore();
}

function safeFilename(value) {
  return String(value || "pokemon")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pokemon";
}

export async function generateCaptureTicket(encounter) {
  if (!canGenerateCaptureTicket(encounter)) {
    throw new Error("Capture ticket is unavailable for this encounter");
  }

  const data = buildCaptureTicketData(encounter, formatCaptureTimestamp);
  const theme = THEMES[resolveCaptureTicketTheme(encounter)];
  if (!theme) throw new Error("Capture ticket theme is unavailable");

  await ensureFont();
  const [backpaperImage, pokemonSpriteImage, frameImage] = await Promise.all([
    loadImage(theme.backpaper),
    loadRemoteImage(data.spriteUrl),
    loadImage(theme.frame)
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = TICKET_LAYOUT.canvas.width;
  canvas.height = TICKET_LAYOUT.canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Capture ticket canvas is unavailable");

  // Pixel art contract: smoothing stays disabled for the entire raster pass.
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(backpaperImage, 0, 0, canvas.width, canvas.height);
  drawPokemonSprite(ctx, pokemonSpriteImage, TICKET_LAYOUT.sprite);
  ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

  drawText(ctx, data.pokemonName, TICKET_LAYOUT.pokemonName, {
    fill: theme.nameFill,
    stroke: theme.nameStroke
  });
  drawText(ctx, data.qualityLine, TICKET_LAYOUT.qualityLine, { fill: theme.dataFill });
  drawText(ctx, data.capturedBy, TICKET_LAYOUT.capturedBy, { fill: theme.dataFill });
  drawText(ctx, data.timestamp, TICKET_LAYOUT.timestamp, { fill: theme.dataFill });

  const metadata = {
    Title: `PP Prize Ticket - ${data.pokemonName}`,
    Author: "Rhyxus",
    Artwork: "Capture ticket frame designed by Rhyxus",
    FrameFingerprint: FRAME_FINGERPRINT,
    FrameAssetSHA256: theme.frameSha256,
    Software: "PokePixel Hunt Analyzer",
    Theme: data.theme
  };

  const blob = await canvasToPngBlobWithMetadata(canvas, metadata);
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `${safeFilename(encounter.speciesName)}-${data.theme}-capture-ticket.png`,
    data
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openCaptureTicketPreview(encounter) {
  const result = await generateCaptureTicket(encounter);
  document.getElementById(PREVIEW_HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = PREVIEW_HOST_ID;
  host.style.cssText = "all:initial;position:fixed;inset:0;display:block;width:100vw;height:100vh;z-index:2147483647;pointer-events:auto;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host{all:initial;position:fixed;inset:0;display:block;width:100vw;height:100vh;z-index:2147483647;pointer-events:auto}
      .backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Arial,sans-serif;box-sizing:border-box}
      .box{background:#1f201d;border:1px solid #4b4c45;padding:10px;box-shadow:0 12px 36px rgba(0,0,0,.55);max-height:calc(100vh - 36px);overflow:auto;box-sizing:border-box}
      img{display:block;width:303px;height:500px;image-rendering:pixelated;background:transparent}
      .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}
      button{background:#2c2d29;color:#ddd;border:1px solid #5a5b53;border-radius:3px;padding:5px 9px;font:11px Arial,sans-serif;cursor:pointer}
      button:hover{background:#373832}
      .download{color:#e7d79f}
    </style>
    <div class="backdrop">
      <div class="box" role="dialog" aria-modal="true" aria-label="Capture Ticket preview">
        <img alt="Capture Ticket preview">
        <div class="actions">
          <button class="download" type="button">Download PNG</button>
          <button class="close" type="button">Close</button>
        </div>
      </div>
    </div>`;

  shadow.querySelector("img").src = result.url;
  const close = () => {
    document.removeEventListener("keydown", onKeydown, true);
    URL.revokeObjectURL(result.url);
    host.remove();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };

  shadow.querySelector(".close").addEventListener("click", close);
  shadow.querySelector(".download").addEventListener(
    "click",
    () => downloadBlob(result.blob, result.filename)
  );
  shadow.querySelector(".backdrop").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  document.addEventListener("keydown", onKeydown, true);

  const mountTarget = document.body || document.documentElement;
  mountTarget.appendChild(host);
  shadow.querySelector(".close")?.focus();
}
