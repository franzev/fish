import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookingConfirmationScreen } from "./booking-confirmation-screen";

describe("BookingConfirmationScreen", () => {
  it("renders the booked lesson in the explicit 12-hour format", () => {
    render(
      <BookingConfirmationScreen
        coach={{ id: "coach-1", displayName: "Patricia", avatarUrl: null }}
        lesson={{
          id: "slot-1",
          coachId: "coach-1",
          startsAt: "2026-07-21T10:30:00.000Z",
          endsAt: "2026-07-21T11:20:00.000Z",
          durationMinutes: 50,
          bookedByClientId: "client-1",
          bookedAt: "2026-07-14T00:00:00.000Z",
        }}
        locale="en-US"
        timeZone="Asia/Manila"
        timeFormatPref="12h"
      />
    );
    expect(screen.getByRole("heading", { name: "Your lesson is booked" })).toBeInTheDocument();
    expect(screen.getByText("6:30 PM")).toBeInTheDocument();
    expect(screen.queryByText("18:30")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/home");
  });
});
