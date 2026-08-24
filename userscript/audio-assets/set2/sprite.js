import chunk1 from "./chunk-1.js";
import chunk2 from "./chunk-2.js";
import chunk3 from "./chunk-3.js";
import chunk4 from "./chunk-4.js";
import chunk5 from "./chunk-5.js";
import chunk6 from "./chunk-6.js";
import chunk7 from "./chunk-7.js";
import chunk8 from "./chunk-8.js";
import chunk9 from "./chunk-9.js";
import chunk10 from "./chunk-10.js";

export const SET2_SPRITE_URI = `data:audio/ogg;base64,${chunk1}${chunk2}${chunk3}${chunk4}${chunk5}${chunk6}${chunk7}${chunk8}${chunk9}${chunk10}`;

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
