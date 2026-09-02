import assert from "node:assert/strict";
import test from "node:test";

import {
  audioVolumeGain,
  DEFAULT_AUDIO_VOLUME_PERCENT,
  normalizeAudioVolumePercent
} from "../../domain/audioVolume.js";

test("audio volume defaults to 100 and clamps to the supported range", () => {
  assert.equal(normalizeAudioVolumePercent(null), 0);
  assert.equal(normalizeAudioVolumePercent(undefined), DEFAULT_AUDIO_VOLUME_PERCENT);
  assert.equal(normalizeAudioVolumePercent(-20), 0);
  assert.equal(normalizeAudioVolumePercent(140), 100);
});

test("audio volume follows five-percent steps and converts to Web Audio gain", () => {
  assert.equal(normalizeAudioVolumePercent(63), 65);
  assert.equal(audioVolumeGain(65), 0.65);
});
