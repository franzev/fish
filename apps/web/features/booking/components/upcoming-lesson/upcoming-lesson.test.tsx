import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/calls", () => ({
  useCall: () => ({ startCall: vi.fn(), busy: false, notice: null }),
}));

import { UpcomingLesson } from "./upcoming-lesson";

const data = {
  coach: { id: "coach-1", displayName: "Patricia", avatarUrl: null },
  lesson: {
    id: "slot-1",
    coachId: "coach-1",
    startsAt: "2026-07-21T10:30:00.000Z",
    endsAt: "2026-07-21T11:20:00.000Z",
    durationMinutes: 50,
    bookedByClientId: "client-1",
    bookedAt: "2026-07-14T00:00:00.000Z",
  },
  locale: "en-US",
  timeZone: "Asia/Manila",
  timeFormatPref: "24h" as const,
};

describe("UpcomingLesson", () => {
  it("keeps the call action hidden before the join window", () => {
    render(<UpcomingLesson data={data} now={new Date("2026-07-21T10:19:59.000Z")} />);
    expect(screen.getByText(/18:30 with Patricia/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join lesson" })).not.toBeInTheDocument();
  });

  it("shows one join action when the lesson window opens", () => {
    render(<UpcomingLesson data={data} now={new Date("2026-07-21T10:20:00.000Z")} />);
    expect(screen.getByRole("button", { name: "Join lesson" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
