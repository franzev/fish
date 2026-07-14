import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LessonSlot } from "@/lib/services";
import { AvailabilityTable } from "./availability-table";

const coachId = "22222222-2222-4222-8222-222222222222";

function slot(id: string, startsAt: string): LessonSlot {
  return {
    id,
    coachId,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 50 * 60 * 1000).toISOString(),
    durationMinutes: 50,
    bookedByClientId: null,
    bookedAt: null,
  };
}

const slots = [
  slot("11111111-1111-4111-8111-111111111111", "2026-07-19T00:00:00.000Z"),
  slot("33333333-3333-4333-8333-333333333333", "2026-07-22T06:30:00.000Z"),
  slot("44444444-4444-4444-8444-444444444444", "2026-07-25T12:00:00.000Z"),
  slot("55555555-5555-4555-8555-555555555555", "2026-07-26T01:15:00.000Z"),
];

describe("AvailabilityTable", () => {
  it("lays availability out as a Sunday-to-Saturday time table", () => {
    const onSelect = vi.fn();
    render(
      <AvailabilityTable
        slots={slots}
        selectedId=""
        locale="en-US"
        timeZone="Asia/Manila"
        timeFormatPref="24h"
        onSelect={onSelect}
      />
    );

    const table = screen.getByRole("table");
    expect(table).not.toHaveClass("min-w-calendar");
    expect(table.parentElement).not.toHaveClass("overflow-x-auto");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(7);
    expect(within(table).queryByRole("rowheader")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous week" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next week" })).toBeEnabled();
    expect(within(table).getByRole("columnheader", { name: "Sun Jul 19" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Sat Jul 25" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "08:00" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "14:30" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "20:00" })).toBeInTheDocument();
    expect(within(table).getAllByLabelText("Not available").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Wednesday, July 22" })).toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button", { name: "14:30" }));
    expect(onSelect).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333");

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("heading", { name: "Week of July 26" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous week" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
    expect(within(screen.getByRole("table")).getByRole("button", { name: "09:15" }))
      .toBeInTheDocument();
  });

  it("uses 12-hour labels and keeps selected typography and geometry stable", () => {
    render(
      <AvailabilityTable
        slots={slots}
        selectedId="11111111-1111-4111-8111-111111111111"
        locale="en-US"
        timeZone="Asia/Manila"
        timeFormatPref="12h"
        onSelect={vi.fn()}
      />
    );

    const selected = within(screen.getByRole("table")).getByRole("button", { name: "8:00 AM" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveClass("border-border", "bg-surface-3");
    expect(selected).not.toHaveClass("font-semibold");
    expect(selected.querySelector("svg")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByRole("button", { name: "08:00" })).not.toBeInTheDocument();
  });
});
