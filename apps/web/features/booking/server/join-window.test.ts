import { describe, expect, it } from "vitest";
import { getLessonJoinWindowMinutes } from "./join-window";

describe("lesson join window environment", () => {
  it("reads a whole-minute join window from the environment", () => {
    expect(
      getLessonJoinWindowMinutes({ LESSON_JOIN_WINDOW_MINUTES: " 25 " })
    ).toBe(25);
  });

  it("allows the lesson to open exactly when it starts", () => {
    expect(
      getLessonJoinWindowMinutes({ LESSON_JOIN_WINDOW_MINUTES: "0" })
    ).toBe(0);
  });

  it.each([undefined, "", "-1", "1.5", "soon", "1441"])(
    "uses ten minutes for invalid value %s",
    (value) => {
      expect(
        getLessonJoinWindowMinutes({ LESSON_JOIN_WINDOW_MINUTES: value })
      ).toBe(10);
    }
  );
});
