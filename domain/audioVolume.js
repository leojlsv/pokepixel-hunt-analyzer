export const DEFAULT_AUDIO_VOLUME_PERCENT = 100;

export function normalizeAudioVolumePercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AUDIO_VOLUME_PERCENT;
  return Math.min(100, Math.max(0, Math.round(parsed / 5) * 5));
}

export function audioVolumeGain(value) {
  return normalizeAudioVolumePercent(value) / 100;
}
