const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

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

function hasPngSignature(bytes) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function pngTextChunk(keyword, value) {
  const encoder = new TextEncoder();
  const type = encoder.encode("tEXt");
  const data = encoder.encode(`${keyword}\0${value}`);
  const crc = crc32(concatBytes([type, data]));
  return concatBytes([uint32Bytes(data.length), type, data, uint32Bytes(crc)]);
}

export function injectPngMetadata(pngBytes, metadata) {
  if (!(pngBytes instanceof Uint8Array) || pngBytes.length < 20 || !hasPngSignature(pngBytes)) {
    throw new Error("Capture ticket: invalid PNG output");
  }

  let offset = PNG_SIGNATURE.length;
  let iendOffset = -1;

  while (offset + 12 <= pngBytes.length) {
    const length = (
      (pngBytes[offset] << 24) |
      (pngBytes[offset + 1] << 16) |
      (pngBytes[offset + 2] << 8) |
      pngBytes[offset + 3]
    ) >>> 0;
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > pngBytes.length) {
      throw new Error("Capture ticket: invalid PNG chunk length");
    }

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

    offset = chunkEnd;
  }

  if (iendOffset < 0) {
    throw new Error("Capture ticket: invalid PNG output");
  }

  const chunks = Object.entries(metadata).map(([key, value]) =>
    pngTextChunk(key, String(value))
  );

  return concatBytes([
    pngBytes.slice(0, iendOffset),
    ...chunks,
    pngBytes.slice(iendOffset)
  ]);
}

export async function canvasToPngBlobWithMetadata(canvas, metadata) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => value
        ? resolve(value)
        : reject(new Error("Could not encode capture ticket PNG")),
      "image/png"
    );
  });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const encoded = injectPngMetadata(bytes, metadata);
  return new Blob([encoded], { type: "image/png" });
}
