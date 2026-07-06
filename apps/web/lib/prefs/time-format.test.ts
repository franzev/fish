import { describe, expect, it } from "vitest";
import { formatTimeOfDay, normalizeTimeFormatPref } from "./time-format";

describe("time format preferences", () => {
  it("normalizes only the stored time format preference values", () => {
    expect(normalizeTimeFormatPref("12h")).toBe("12h");
    expect(normalizeTimeFormatPref("24h")).toBe("24h");
    expect(normalizeTimeFormatPref("system")).toBeNull();
    expect(normalizeTimeFormatPref(null)).toBeNull();
  });

  it("formats clock time in an explicit 12-hour format", () => {
    expect(
      formatTimeOfDay("2026-07-05T13:05:00.000Z", "12h", {
        locale: "en-US",
        timeZone: "UTC",
      })
    ).toBe("1:05 PM");
  });

  it("formats clock time in an explicit 24-hour format", () => {
    expect(
      formatTimeOfDay("2026-07-05T13:05:00.000Z", "24h", {
        locale: "en-US",
        timeZone: "UTC",
      })
    ).toBe("13:05");
  });

  it("returns an empty string for invalid timestamps", () => {
    expect(formatTimeOfDay("not-a-date", "24h")).toBe("");
  });
});
