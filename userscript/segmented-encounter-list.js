/** Sorted Current ranks in bounded blocks; avoids full-array front splice. */
export function createSegmentedEncounterList(compare, { blockSize = 256 } = {}) {
  if (typeof compare !== "function" || !Number.isSafeInteger(blockSize) ||
      blockSize < 16 || blockSize > 4096) {
    throw new TypeError("Invalid segmented encounter comparator/block size");
  }
  const blocks = [];
  let sizes = [], tree = [0], count = 0;
  function reindex() {
    sizes = blocks.map(block => block.length);
    tree = Array(sizes.length + 1).fill(0);
    for (let i = 0; i < sizes.length; i++) {
      for (let j = i + 1; j < tree.length; j += j & -j) tree[j] += sizes[i];
    }
  }
  function prefix(index) {
    let sum = 0;
    for (let j = index; j > 0; j -= j & -j) sum += tree[j];
    return sum;
  }
  function locate(rank) {
    if (!Number.isSafeInteger(rank) || rank < 0 || rank >= count) return null;
    let index = 0, sum = 0, bit = 1;
    while (bit * 2 < tree.length) bit *= 2;
    for (; bit; bit >>= 1) {
      const next = index + bit;
      if (next < tree.length && sum + tree[next] <= rank) {
        sum += tree[next]; index = next;
      }
    }
    return { index, offset: rank - sum };
  }
  function replaceSorted(rows) {
    if (!Array.isArray(rows)) throw new TypeError("Sorted encounter array required");
    blocks.length = 0;
    for (let i = 0; i < rows.length; i += blockSize) {
      blocks.push(rows.slice(i, i + blockSize));
    }
    count = rows.length;
    reindex();
  }
  function insert(value) {
    if (!blocks.length) {
      blocks.push([value]); count = 1; reindex(); return 0;
    }
    let low = 0, high = blocks.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (compare(value, blocks[mid].at(-1)) < 0) high = mid;
      else low = mid + 1;
    }
    const bi = Math.min(low, blocks.length - 1);
    const block = blocks[bi];
    low = 0; high = block.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (compare(value, block[mid]) < 0) high = mid;
      else low = mid + 1;
    }
    const rank = prefix(bi) + low;
    block.splice(low, 0, value);
    count++;
    if (block.length > blockSize * 2) {
      blocks.splice(bi + 1, 0, block.splice(blockSize));
      reindex();
    } else {
      sizes[bi]++;
      for (let j = bi + 1; j < tree.length; j += j & -j) tree[j]++;
    }
    return rank;
  }
  function get(rank) {
    const position = locate(rank);
    return position ? blocks[position.index][position.offset] : undefined;
  }
  function set(rank, value) {
    const position = locate(rank);
    if (!position) throw new RangeError("Invalid encounter rank");
    blocks[position.index][position.offset] = value;
  }
  function findIndex(predicate) {
    if (typeof predicate !== "function") throw new TypeError("Predicate required");
    let rank = 0;
    for (const block of blocks) for (const item of block) {
      if (predicate(item, rank)) return rank;
      rank++;
    }
    return -1;
  }
  return Object.freeze({
    get length() { return count; },
    get, set, findIndex, insert, replaceSorted,
    stats() { return { length: count, blockCount: blocks.length,
      maxBlockLength: blocks.reduce((max, block) => Math.max(max, block.length), 0) }; }
  });
}
