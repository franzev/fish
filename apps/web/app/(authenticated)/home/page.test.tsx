import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    // next/navigation's redirect() throws in real usage to halt rendering;
    // mirror that so the component body stops executing past the call.
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: vi.fn() }),
}));

const { getClientHomeDataMock, getUpcomingLessonDataMock } = vi.hoisted(() => ({
  getClientHomeDataMock: vi.fn(),
  getUpcomingLessonDataMock: vi.fn(),
}));
vi.mock("@/features/auth/server", () => ({
  getClientHomeData: getClientHomeDataMock,
}));
vi.mock("@/features/booking/server", () => ({
  getUpcomingLessonData: getUpcomingLessonDataMock,
}));
vi.mock("@/features/booking", () => ({
  UpcomingLesson: () => <div>Your next lesson card</div>,
}));

import ClientHomePage from "./page";

describe("ClientHomePage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getClientHomeDataMock.mockReset();
    getUpcomingLessonDataMock.mockReset();
    getUpcomingLessonDataMock.mockResolvedValue(null);
  });

  it("silently forwards a coach to /coach (D-03 wrong door)", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "coach",
      firstName: "Dana",
      coachId: null,
      coachName: null,
    });

    await expect(ClientHomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/coach");
  });

  it("renders the unassigned empty state and greeting when no coach is assigned (SHEL-02)", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachId: null,
      coachName: null,
    });

    const Page = await ClientHomePage();
    render(Page);

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(
      screen.getByText("We're getting things ready for you.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Coach Dana/)).not.toBeInTheDocument();
  });

  it("offers booking as the assigned client's one forward action", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachId: "coach-id",
      coachName: "Coach Dana",
    });

    const Page = await ClientHomePage();
    render(Page);

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(
      screen.getByText("Your next lesson is ready to book.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Book a lesson" })
    ).toHaveAttribute("href", "/book");
  });

  it("shows the next lesson and a quieter action to book another", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachId: "coach-id",
      coachName: "Coach Dana",
    });
    getUpcomingLessonDataMock.mockResolvedValueOnce({ lesson: { id: "lesson-1" } });
    render(await ClientHomePage());
    expect(screen.getByText("Your next lesson card")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book another lesson" }))
      .toHaveAttribute("href", "/book");
  });

  it("keeps the assigned call as the only forward action and avoids choice lists", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = (pageSource.match(/variant="primary"/g) ?? []).length;
    expect(matches).toBe(0);
    expect(pageSource).not.toMatch(/templates\.map|plans\.map/i);
  });
});
