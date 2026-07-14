export type VideoQualityPreference = "auto" | "data-saver";

export const DEFAULT_VIDEO_QUALITY_PREFERENCE: VideoQualityPreference = "auto";

const STORAGE_KEY = "fish.video-quality-preference";

export function readVideoQualityPreference(): VideoQualityPreference {
  if (typeof window === "undefined") return DEFAULT_VIDEO_QUALITY_PREFERENCE;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "data-saver" ? stored : DEFAULT_VIDEO_QUALITY_PREFERENCE;
  } catch {
    return DEFAULT_VIDEO_QUALITY_PREFERENCE;
  }
}

export function writeVideoQualityPreference(
  preference: VideoQualityPreference
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable in privacy modes. The active call still uses
    // the selected preference; only remembering it for the next call is lost.
  }
}
