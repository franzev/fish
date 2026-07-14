import { describe, expect, it, vi } from "vitest";
import type { AppServices, LessonSlot } from "@/lib/services";
import { getBookingConfirmationData, getBookingPageData } from "./page-data";

const lesson: LessonSlot = {
  id: "11111111-1111-4111-8111-111111111111",
  coachId: "coach-1",
  startsAt: "2026-07-21T10:30:00.000Z",
  endsAt: "2026-07-21T11:20:00.000Z",
  durationMinutes: 50,
  bookedByClientId: null,
  bookedAt: null,
};

function services(role: "client" | "coach" = "client") {
  return {
    auth: {
      getCurrentUser: vi.fn().mockResolvedValue({ ok: true, data: { id: `${role}-1` } }),
    },
    database: {
      profiles: {
        findById: vi.fn().mockResolvedValue({
          ok: true,
          data: { role, displayName: role === "client" ? "Alex Rivera" : "Patricia" },
        }),
        findDisplayNameById: vi.fn().mockResolvedValue({
          ok: true,
          data: { displayName: "Patricia" },
        }),
      },
      clientProfiles: {
        findById: vi.fn().mockResolvedValue({
          ok: true,
          data: { locale: "en-PH", timezone: "Asia/Manila", timeFormatPref: "24h" },
        }),
      },
      coachClients: {
        findAssignmentForClient: vi.fn().mockResolvedValue({
          ok: true,
          data: { coachId: "coach-1" },
        }),
      },
      lessons: {
        listAvailable: vi.fn().mockResolvedValue({ ok: true, data: [lesson] }),
        findUpcomingForClient: vi.fn().mockResolvedValue({ ok: true, data: null }),
        findBookedByIdForClient: vi.fn().mockResolvedValue({
          ok: true,
          data: { ...lesson, bookedByClientId: "client-1" },
        }),
      },
    },
    avatars: {
      resolveUrls: vi.fn().mockResolvedValue([]),
    },
  } as unknown as AppServices;
}

describe("booking page data", () => {
  it("loads fixed coach availability with the saved timezone and 24-hour preference", async () => {
    const data = await getBookingPageData(services());
    expect(data).toMatchObject({
      role: "client",
      locale: "en-PH",
      timeZone: "Asia/Manila",
      timeFormatPref: "24h",
      coach: { id: "coach-1", displayName: "Patricia" },
      slots: [{ id: lesson.id }],
    });
  });

  it("loads only the signed-in client's booked lesson for confirmation", async () => {
    const data = await getBookingConfirmationData(lesson.id, services());
    expect(data).toMatchObject({
      role: "client",
      lesson: { id: lesson.id, bookedByClientId: "client-1" },
    });
  });

  it("keeps coaches out before querying lesson availability", async () => {
    const injected = services("coach");
    await expect(getBookingPageData(injected)).resolves.toEqual({ role: "coach" });
    expect(injected.database.lessons.listAvailable).not.toHaveBeenCalled();
  });
});
