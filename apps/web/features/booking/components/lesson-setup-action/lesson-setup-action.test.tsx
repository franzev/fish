import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LessonSetupAction } from "./lesson-setup-action";

describe("LessonSetupAction", () => {
  afterEach(() => vi.useRealTimers());

  it("changes from setup to join without requiring a page refresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T10:19:59.000Z"));
    render(
      <LessonSetupAction
        lessonId="slot-1"
        startsAt="2026-07-21T10:30:00.000Z"
        endsAt="2026-07-21T11:20:00.000Z"
        joinWindowMinutes={10}
        initialNow="2026-07-21T10:19:59.000Z"
      />
    );
    expect(screen.getByRole("link", { name: "Check camera and microphone" }))
      .toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("link", { name: "Join lesson" })).toBeInTheDocument();
  });
});
