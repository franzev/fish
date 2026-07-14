import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingScreen } from "./booking-screen";
import type { BookLessonAction } from "../../contracts";

const slots = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    coachId: "22222222-2222-4222-8222-222222222222",
    startsAt: "2026-07-21T10:30:00.000Z",
    endsAt: "2026-07-21T11:20:00.000Z",
    durationMinutes: 50,
    bookedByClientId: null,
    bookedAt: null,
  },
];
const props = {
  coach: {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "Patricia",
    avatarUrl: null,
  },
  slots,
  upcomingLesson: null,
  locale: "en-US",
  timeZone: "Asia/Manila",
  timeFormatPref: "24h" as const,
};

describe("BookingScreen", () => {
  it("renders an immersive 24-hour schedule and submits the selected slot", async () => {
    const action = vi.fn<BookLessonAction>(async () => ({ status: "idle" as const }));
    render(<BookingScreen {...props} bookAction={action} />);

    expect(screen.getByRole("heading", { name: "Book your lesson" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "18:30" })).toBeInTheDocument();
    expect(screen.queryByText("6:30 PM")).not.toBeInTheDocument();
    expect(screen.getByText(/Times shown in Asia\/Manila \(UTC\+8\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "18:30" }));
    fireEvent.click(screen.getByRole("button", { name: "Book lesson" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    const submitted = action.mock.calls[0]?.[1];
    expect(submitted.get("slotId")).toBe(slots[0]?.id);
  });

  it("guides an empty submission without disabling the primary action", async () => {
    const action = vi.fn<BookLessonAction>(async () => ({
      status: "notice" as const,
      notice: "Choose an available lesson time.",
    }));
    render(<BookingScreen {...props} bookAction={action} />);
    const button = screen.getByRole("button", { name: "Book lesson" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(await screen.findByText("Choose an available lesson time.")).toBeInTheDocument();
  });

  it("shows the existing lesson instead of another slot picker", () => {
    render(
      <BookingScreen
        {...props}
        slots={[]}
        upcomingLesson={{ ...slots[0]!, bookedByClientId: "client-1", bookedAt: "2026-07-14T00:00:00.000Z" }}
        bookAction={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Your lesson is already booked" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book lesson" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View your lesson" })).toHaveAttribute(
      "href",
      `/book/confirmed/${slots[0]?.id}`
    );
  });
});
