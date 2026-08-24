import { test } from "node:test";
import assert from "node:assert/strict";

import { injectPngMetadata } from "../../userscript/png-metadata.js";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function minimalPng() {
  // Signature + zero-length IEND. Source CRC is irrelevant to the injector;
  // generated metadata CRCs are validated below.
  return new Uint8Array([
    ...PNG_SIGNATURE,
    0, 0, 0, 0,
    73, 69, 78, 68,
    174, 66, 96, 130
  ]);
}

function readUint32(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
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

function chunks(bytes) {
  const output = [];
  let offset = PNG_SIGNATURE.length;

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const typeBytes = bytes.slice(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const data = bytes.slice(offset + 8, offset + 8 + length);
    const storedCrc = readUint32(bytes, offset + 8 + length);
    output.push({ type, data, storedCrc, typeBytes });
    offset += 12 + length;
    if (type === "IEND") break;
  }

  return output;
}

test("PNG metadata is inserted before IEND with valid CRCs", () => {
  const encoded = injectPngMetadata(minimalPng(), {
    Author: "Rhyxus",
    Theme: "shiny"
  });
  const parsed = chunks(encoded);

  assert.deepEqual(parsed.map((chunk) => chunk.type), ["tEXt", "tEXt", "IEND"]);

  const decoder = new TextDecoder();
  assert.equal(decoder.decode(parsed[0].data), "Author\0Rhyxus");
  assert.equal(decoder.decode(parsed[1].data), "Theme\0shiny");

  for (const chunk of parsed.filter((entry) => entry.type === "tEXt")) {
    const crcInput = new Uint8Array(chunk.typeBytes.length + chunk.data.length);
    crcInput.set(chunk.typeBytes, 0);
    crcInput.set(chunk.data, chunk.typeBytes.length);
    assert.equal(chunk.storedCrc, crc32(crcInput));
  }
});

test("PNG metadata injection rejects an invalid signature", () => {
  const invalid = minimalPng();
  invalid[0] = 0;

  assert.throws(
    () => injectPngMetadata(invalid, { Author: "Rhyxus" }),
    /invalid PNG output/
  );
});

test("PNG metadata injection rejects truncated chunk lengths", () => {
  const invalid = new Uint8Array([
    ...PNG_SIGNATURE,
    0, 0, 0, 50,
    73, 68, 65, 84,
    1, 2, 3, 4
  ]);

  assert.throws(
    () => injectPngMetadata(invalid, { Author: "Rhyxus" }),
    /invalid PNG chunk length/
  );
});
