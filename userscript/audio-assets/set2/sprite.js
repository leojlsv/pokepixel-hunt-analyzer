import chunk1 from "./chunk-1.js";
import chunk2 from "./chunk-2.js";
import chunk3 from "./chunk-3.js";
import chunk4 from "./chunk-4.js";
import chunk5a from "./chunk-5a.js";
import chunk5b from "./chunk-5b.js";
import chunk5c from "./chunk-5c.js";
import chunk5d from "./chunk-5d.js";
import chunk6 from "./chunk-6.js";
import chunk7 from "./chunk-7.js";
import chunk8 from "./chunk-8.js";
import chunk9a from "./chunk-9a.js";
import chunk9b from "./chunk-9b.js";
import chunk9c from "./chunk-9c.js";
import chunk9d from "./chunk-9d.js";
import chunk10 from "./chunk-10.js";

export const SET2_SPRITE_URI = `data:audio/ogg;base64,${chunk1}${chunk2}${chunk3}${chunk4}${chunk5a}${chunk5b}${chunk5c}${chunk5d}${chunk6}${chunk7}${chunk8}${chunk9a}${chunk9b}${chunk9c}${chunk9d}${chunk10}`;

export const SET2_SEGMENTS = Object.freeze({
  epic_captured: Object.freeze({ offset: 0, duration: 1.764333 }),
  epic_fled: Object.freeze({ offset: 1.884333, duration: 0.835938 }),
  legendary_captured: Object.freeze({ offset: 2.840271, duration: 1.3845 }),
  legendary_fled: Object.freeze({ offset: 4.344771, duration: 1.927271 }),
  mythic_captured: Object.freeze({ offset: 6.392042, duration: 1.43675 }),
  mythic_fled: Object.freeze({ offset: 7.948792, duration: 1.462875 }),
  shiny_captured: Object.freeze({ offset: 9.531667, duration: 4.179604 }),
  shiny_fled: Object.freeze({ offset: 13.831271, duration: 0.816979 })
});
