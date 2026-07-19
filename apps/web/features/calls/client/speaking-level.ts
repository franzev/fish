export function smoothSpeakingLevels(previous: number, measured: number): number {
  const normalized = Math.min(1, Math.max(0, measured / 0.3));
  const response = normalized > previous ? 0.35 : 0.12;
  const next = previous + (normalized - previous) * response;
  return next < 0.01 ? 0 : next;
}

export function speakingActivityUntil(
  now: number,
  measured: number,
  microphoneEnabled: boolean,
  previousUntil: number
): number {
  return microphoneEnabled && measured >= 0.025 ? now + 250 : previousUntil;
}

export function isSpeakingActive(now: number, activeUntil: number, microphoneEnabled: boolean): boolean {
  return microphoneEnabled && now < activeUntil;
}
