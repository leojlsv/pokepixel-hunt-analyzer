/**
 * Deterministic JSON serialization.
 *
 * Same rules as JSON.stringify (undefined values/keys are omitted from
 * objects, undefined array items become null), except object keys are
 * always emitted in sorted order so semantically identical objects always
 * produce the same string regardless of insertion order.
 *
 * Used as the input to config hashing (domain/configHash.js) — the hash
 * must not change just because a caller built the same config object with
 * keys in a different order.
 */

function stringifyValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return "null";

  const type = typeof value;

  if (type === "number" || type === "boolean" || type === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => {
      const serialized = stringifyValue(item);
      return serialized === undefined ? "null" : serialized;
    });

    return `[${items.join(",")}]`;
  }

  if (type === "object") {
    const keys = Object.keys(value).sort();
    const parts = [];

    for (const key of keys) {
      const serialized = stringifyValue(value[key]);
      if (serialized === undefined) continue;

      parts.push(`${JSON.stringify(key)}:${serialized}`);
    }

    return `{${parts.join(",")}}`;
  }

  // Functions, symbols, etc. — same as JSON.stringify, not representable.
  return undefined;
}

export function stableStringify(value) {
  const serialized = stringifyValue(value);

  if (serialized === undefined) {
    throw new TypeError(
      "stableStringify: value is not JSON-serializable"
    );
  }

  return serialized;
}
