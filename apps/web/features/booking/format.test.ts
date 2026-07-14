import { describe, expect, it } from "vitest";
import {
  formatLessonDate,
  formatLessonTime,
  formatTimeZoneLabel,
  isLessonJoinable,
  lessonDateKey,
} from "./format";

describe("lesson formatting", () => {
  const options = { locale: "en-US", timeZone: "Asia/Manila" };
  const timestamp = "2026-07-21T10:30:00.000Z";

  it("uses the explicit 12-hour preference", () => {
    expect(formatLessonTime(timestamp, "12h", options)).toBe("6:30 PM");
  });

  it("uses the explicit 24-hour preference", () => {
    expect(formatLessonTime(timestamp, "24h", options)).toBe("18:30");
  });

  it("formats the local lesson date and stable grouping key", () => {
    expect(formatLessonDate(timestamp, options)).toBe("Tuesday, July 21");
    expect(lessonDateKey(timestamp, options.timeZone)).toBe("2026-07-21");
  });

  it("labels Manila with its UTC offset", () => {
    expect(formatTimeZoneLabel("Asia/Manila", timestamp)).toBe("Asia/Manila (UTC+8)");
  });

  it("uses the lesson date when a timezone observes daylight saving time", () => {
    expect(formatTimeZoneLabel("America/New_York", "2026-01-15T12:00:00.000Z"))
      .toBe("America/New_York (UTC-5)");
    expect(formatTimeZoneLabel("America/New_York", "2026-07-15T12:00:00.000Z"))
      .toBe("America/New_York (UTC-4)");
  });

  it("opens the configured join window before start and closes at lesson end", () => {
    const lesson = {
      startsAt: "2026-07-21T10:30:00.000Z",
      endsAt: "2026-07-21T11:20:00.000Z",
    };
    expect(isLessonJoinable(lesson, 15, new Date("2026-07-21T10:14:59.000Z"))).toBe(false);
    expect(isLessonJoinable(lesson, 15, new Date("2026-07-21T10:15:00.000Z"))).toBe(true);
    expect(isLessonJoinable(lesson, 15, new Date("2026-07-21T11:19:59.000Z"))).toBe(true);
    expect(isLessonJoinable(lesson, 15, new Date("2026-07-21T11:20:00.000Z"))).toBe(false);
  });
});
