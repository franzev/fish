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

const { getClientHomeDataMock } = vi.hoisted(() => ({
  getClientHomeDataMock: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  getClientHomeData: getClientHomeDataMock,
}));

import ClientHomePage from "./page";

describe("ClientHomePage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getClientHomeDataMock.mockReset();
  });

  it("silently forwards a coach to /coach (D-03 wrong door)", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "coach",
      firstName: "Dana",
      coachName: null,
      onboarding: null,
    });

    await expect(ClientHomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/coach");
  });

  it("renders the unassigned empty state and greeting when no coach is assigned (SHEL-02)", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachName: null,
      onboarding: null,
    });

    const Page = await ClientHomePage();
    render(Page);

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(
      screen.getByText("We're getting things ready for you.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Coach Dana/)).not.toBeInTheDocument();
  });

  it("renders the assigned empty state naming the coach (D-16)", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachName: "Coach Dana",
      onboarding: null,
    });

    const Page = await ClientHomePage();
    render(Page);

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(
      screen.getByText("Your coach Coach Dana is setting things up.")
    ).toBeInTheDocument();
  });

  it("renders one assigned onboarding start action when assessment is ready", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachName: "Coach Dana",
      onboarding: {
        versionId: "version-1",
        status: "not_started",
        attemptId: null,
        currentQuestionId: "q-1",
        questions: [],
        answers: [],
        savedAnswers: {},
      },
    });

    const Page = await ClientHomePage();
    const { container } = render(Page);

    const action = screen.getByRole("link", { name: "Start onboarding" });
    expect(action).toHaveAttribute("href", "/onboarding");
    expect(
      screen.getByText("Your coach Coach Dana has one setup step for you.")
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-primary")).toHaveLength(1);
    expect(screen.queryByText(/choose an assessment|pick a plan|gallery/i)).toBeNull();
  });

  it("renders one assigned onboarding resume action after progress is saved", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachName: "Coach Dana",
      onboarding: {
        versionId: "version-1",
        status: "in_progress",
        attemptId: "attempt-1",
        currentQuestionId: "q-2",
        questions: [],
        answers: [],
        savedAnswers: {
          "q-1": { type: "single_select", optionId: "meetings" },
        },
      },
    });

    const Page = await ClientHomePage();
    const { container } = render(Page);

    expect(
      screen.getByRole("link", { name: "Continue onboarding" })
    ).toHaveAttribute("href", "/onboarding");
    expect(container.querySelectorAll(".bg-primary")).toHaveLength(1);
  });

  it("keeps the source to at most one primary action", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = (pageSource.match(/variant="primary"/g) ?? []).length;
    expect(matches).toBeLessThanOrEqual(1);
    expect(pageSource).toContain('href="/onboarding"');
    expect(pageSource).not.toMatch(/assessments\.map|templates\.map|plans\.map/i);
  });
});
