import { describe, expect, it } from "vitest";
import {
  isSpeakingActive,
  speakingActivityUntil,
  smoothSpeakingLevels,
} from "./speaking-level";

describe("speaking level math", () => {
  it("uses faster attack and slower decay with normalization and a floor", () => {
    expect(smoothSpeakingLevels(0, 0.3)).toBeCloseTo(0.35);
    expect(smoothSpeakingLevels(1, 0)).toBeCloseTo(0.88);
    expect(smoothSpeakingLevels(0, 0.001)).toBe(0);
  });

  it("holds speaking activity briefly after the threshold crosses", () => {
    expect(speakingActivityUntil(1000, 0.025, true, 0)).toBe(1250);
    expect(speakingActivityUntil(1000, 0.024, true, 900)).toBe(900);
    expect(isSpeakingActive(1249, 1250, true)).toBe(true);
    expect(isSpeakingActive(1250, 1250, true)).toBe(false);
  });
});
