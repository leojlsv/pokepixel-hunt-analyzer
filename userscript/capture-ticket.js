import {
  buildCaptureTicketData,
  canGenerateCaptureTicket,
  resolveCaptureTicketTheme
} from "../domain/captureTicket.js";
import { formatCaptureTimestamp } from "./encounter-list-model.js";
import shinyBackpaper from "./capture-ticket-assets/shiny_backpaper.png";
import shinyFrame from "./capture-ticket-assets/shiny_ticket_frame.png";
import legendBackpaper from "./capture-ticket-assets/legend_backpaper.png";
import legendFrame from "./capture-ticket-assets/legend_ticket_frame.png";
import mythicBackpaper from "./capture-ticket-assets/mythic_backpaper.png";
import mythicFrame from "./capture-ticket-assets/mythic_ticket_frame.png";

export const ENABLE_CAPTURE_TICKET_DEV = true;

export const TICKET_LAYOUT = Object.freeze({
  canvas: { width: 303, height: 500 },
  sprite: { x: 151.5, y: 251.5, width: 192, height: 192 },
  pokemonName: {
    x: 151.5,
    y: 103.5,
    fontPt: 4.5,
    maxWidth: 200,
    textAlign: "center",
    strokeWidth: 1,
    overflow: "fit"
  },
  qualityLine: {
    x: 151.5,
    y: 405.5,
    fontPt: 1.92,
    maxWidth: 180,
    textAlign: "center",
    overflow: "clip"
  },
  capturedBy: {
    x: 151.5,
    y: 429.5,
    fontPt: 2,
    maxWidth: 180,
    textAlign: "center",
    overflow: "clip"
  },
  timestamp: {
    x: 151.5,
    y: 453.5,
    fontPt: 1.92,
    maxWidth: 180,
    textAlign: "center",
    overflow: "clip"
  }
});

const THEMES = Object.freeze({
  legend: {
    nameFill: "#ffffff",
    nameStroke: "#fe9b5e",
    dataFill: "#c39f65",
    backpaper: legendBackpaper,
    frame: legendFrame,
    frameSha256: "bc97487687979a502333460bb774075820856106f224e8e20c67fd6c09d52d39"
  },
  mythic: {
    nameFill: "#ffffff",
    nameStroke: "#ff9090",
    dataFill: "#c39f65",
    backpaper: mythicBackpaper,
    frame: mythicFrame,
    frameSha256: "b91f352cdb81173493073d9d3baa5e2d0ac50d1885d4947aa836ee2ccae15db0"
  },
  shiny: {
    nameFill: "#ffffff",
    nameStroke: "#7157a8",
    dataFill: "#646d78",
    backpaper: shinyBackpaper,
    frame: shinyFrame,
    frameSha256: "045755f30f7e5b19e40a9b40cd08cac22e1b617bb57ad922929176d6d39a5d31"
  }
});

const GOOGLE_FONT_URL = "https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap";
const FONT_LINK_ID = "pha-capture-ticket-silkscreen";
const PREVIEW_HOST_ID = "pha-capture-ticket-preview";
const ANALYZER_ROOT_ID = "pokepixel-hunt-analyzer-root";
const FRAME_FINGERPRINT = "rhyxus.pp-prize-ticket.v1";

function ptToPx(points) {
  return points * 96 / 72;
}

async function ensureFont() {
  let link = document.getElementById(FONT_LINK_ID);
  if (!link) {
    link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = GOOGLE_FONT_URL;
    (document.head || document.documentElement).appendChild(link);
  }

  if (!document.fonts) return;
  await Promise.race([
    document.fonts.load('6px "Silkscreen"'),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Silkscreen font load timed out")), 6000))
  ]);
}

function loadImage(url, { crossOrigin = false } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
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
    ctx.rect(config.x - config.maxWidth / 2, config.y - clipHeight / 2, config.maxWidth, clipHeight);
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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32Bytes(value) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ]);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function pngTextChunk(keyword, value) {
  const encoder = new TextEncoder();
  const type = encoder.encode("tEXt");
  const data = encoder.encode(`${keyword}\0${value}`);
  const crc = crc32(concatBytes([type, data]));
  return concatBytes([uint32Bytes(data.length), type, data, uint32Bytes(crc)]);
}

function injectPngMetadata(pngBytes, metadata) {
  let offset = 8;
  let iendOffset = -1;

  while (offset + 12 <= pngBytes.length) {
    const length = (
      (pngBytes[offset] << 24) |
      (pngBytes[offset + 1] << 16) |
      (pngBytes[offset + 2] << 8) |
      pngBytes[offset + 3]
    ) >>> 0;
    const type = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7]
    );
    if (type === "IEND") {
      iendOffset = offset;
      break;
    }
    offset += 12 + length;
  }

  if (iendOffset < 0) throw new Error("Capture ticket: invalid PNG output");

  const chunks = Object.entries(metadata).map(([key, value]) => pngTextChunk(key, String(value)));
  return concatBytes([
    pngBytes.slice(0, iendOffset),
    ...chunks,
    pngBytes.slice(iendOffset)
  ]);
}

async function canvasToSignedBlob(canvas, metadata) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode capture ticket PNG")), "image/png");
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const signed = injectPngMetadata(bytes, metadata);
  return new Blob([signed], { type: "image/png" });
}

function safeFilename(value) {
  return String(value || "pokemon")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pokemon";
}

export async function generateCaptureTicket(encounter) {
  if (!ENABLE_CAPTURE_TICKET_DEV || !canGenerateCaptureTicket(encounter)) {
    throw new Error("Capture ticket is unavailable for this encounter");
  }

  const data = buildCaptureTicketData(encounter, formatCaptureTimestamp);
  const theme = THEMES[resolveCaptureTicketTheme(encounter)];
  if (!theme) throw new Error("Capture ticket theme is unavailable");

  await ensureFont();
  const [backpaperImage, pokemonSpriteImage, frameImage] = await Promise.all([
    loadImage(theme.backpaper),
    loadImage(data.spriteUrl, { crossOrigin: true }),
    loadImage(theme.frame)
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = TICKET_LAYOUT.canvas.width;
  canvas.height = TICKET_LAYOUT.canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Capture ticket canvas is unavailable");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(backpaperImage, 0, 0, canvas.width, canvas.height);

  const spriteLayout = TICKET_LAYOUT.sprite;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    pokemonSpriteImage,
    spriteLayout.x - spriteLayout.width / 2,
    spriteLayout.y - spriteLayout.height / 2,
    spriteLayout.width,
    spriteLayout.height
  );
  ctx.imageSmoothingEnabled = true;

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

  const blob = await canvasToSignedBlob(canvas, metadata);
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
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:auto;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host{all:initial}
      .backdrop{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Arial,sans-serif}
      .box{background:#1f201d;border:1px solid #4b4c45;padding:10px;box-shadow:0 12px 36px rgba(0,0,0,.55);max-height:calc(100vh - 36px);overflow:auto}
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
    URL.revokeObjectURL(result.url);
    host.remove();
  };
  shadow.querySelector(".close").addEventListener("click", close);
  shadow.querySelector(".download").addEventListener("click", () => downloadBlob(result.blob, result.filename));
  shadow.querySelector(".backdrop").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });

  document.documentElement.appendChild(host);
}

export function installCaptureTicketDev({ getEncounterById }) {
  if (!ENABLE_CAPTURE_TICKET_DEV) return () => {};

  const host = document.getElementById(ANALYZER_ROOT_ID);
  const shadow = host?.shadowRoot;
  if (!shadow) return () => {};

  function injectButtons() {
    for (const detailRow of shadow.querySelectorAll("#captured-body tr[data-detail-for]")) {
      if (detailRow.querySelector("[data-capture-ticket-dev]")) continue;
      const encounter = getEncounterById(detailRow.dataset.detailFor);
      if (!canGenerateCaptureTicket(encounter)) continue;

      const content = detailRow.querySelector("td > div");
      if (!content) continue;

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.captureTicketDev = "true";
      button.textContent = "Generate Ticket";
      button.title = "Temporary Capture Ticket preview";
      button.style.cssText = "margin-left:auto;background:#2d2e29;color:#dccd95;border:1px solid #595a51;border-radius:3px;padding:3px 6px;font:9px Arial,sans-serif;cursor:pointer;white-space:nowrap;";
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const original = button.textContent;
        button.disabled = true;
        button.textContent = "Generating…";
        try {
          await openCaptureTicketPreview(encounter);
        } catch (error) {
          console.error("PokePixel Hunt Analyzer (Capture Ticket):", error);
          button.title = error?.message || "Capture Ticket generation failed";
          button.textContent = "Ticket Error";
          setTimeout(() => {
            button.textContent = original;
            button.disabled = false;
          }, 1800);
          return;
        }
        button.textContent = original;
        button.disabled = false;
      });
      content.appendChild(button);
    }
  }

  const observer = new MutationObserver(injectButtons);
  observer.observe(shadow, { childList: true, subtree: true });
  injectButtons();

  return () => observer.disconnect();
}
