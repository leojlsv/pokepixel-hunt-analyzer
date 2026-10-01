import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../userscript/closed-hud.js", import.meta.url), "utf8");
const style = source.split("const CLOSED_HUD_STYLE = ")[1];
assert.ok(style, "Closed HUD stylesheet is present");

function block(selector) {
  const text = style.split(selector + " {")[1]?.split("}")[0];
  assert.ok(text, "Missing Closed HUD style: " + selector);
  return text;
}

function px(text, property) {
  const declaration = text.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(property + ":"));
  assert.ok(declaration, "Missing " + property);
  const value = declaration.slice(property.length + 1).trim().split(" ")[0];
  assert.ok(value === "0" || /^[0-9.]+px$/.test(value), "Expected a pixel value for " + property);
  return Number.parseFloat(value);
}

test("Closed HUD 2x2 text fits both rows within the original 220x52 launcher", () => {
  const launcher = block("#pha-toggle.pha-custom-hud");
  const grid = block(".pha-hud-grid");
  const slot = block(".pha-hud-slot");
  const label = block(".pha-hud-slot-label");
  const value = block(".pha-hud-slot-value");
  const inventory = block(".pha-hud-inventory-line");

  assert.equal(px(launcher, "width"), 220);
  assert.equal(px(launcher, "height"), 52);
  assert.equal(px(launcher, "padding"), 2);
  assert.equal(px(grid, "height"), 44);
  assert.match(grid, /grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(slot, /min-height:0/);
  assert.match(label, /white-space:nowrap/);
  assert.match(value, /white-space:nowrap/);
  assert.match(value, /font-variant-numeric:tabular-nums/);

  const rowHeight = (px(grid, "height") - px(grid, "row-gap")) / 2;
  const textHeight = px(label, "font-size") + px(value, "font-size")
    + px(value, "margin-top") + 2 * px(slot, "padding");
  const inventoryHeight = px(label, "font-size") + 11
    + px(inventory, "margin-top") + 2 * px(slot, "padding");
  assert.ok(textHeight <= rowHeight, "Label/value exceeds available row height");
  assert.ok(inventoryHeight <= rowHeight, "Inventory exceeds available row height");
  assert.ok(px(label, "font-size") >= 8, "do not return to 7px labels");
});
