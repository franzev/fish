import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { getClientOnboardingDataMock } = vi.hoisted(() => ({
  getClientOnboardingDataMock: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  getClientOnboardingData: getClientOnboardingDataMock,
}));

vi.mock("./actions", () => ({
  saveOnboardingAnswerAction: vi.fn(),
  finalizeOnboardingAttemptAction: vi.fn(),
}));

import OnboardingPage from "./page";

function primaryActionCount(container: HTMLElement): number {
  return Array.from(container.querySelectorAll("button, a")).filter((element) =>
    element.className.includes("bg-primary")
  ).length;
}

const onboardingData = {
  versionId: "version-1",
  status: "in_progress",
  attemptId: "attempt-1",
  currentQuestionId: "q-2",
  questions: [
    {
      id: "q-1",
      versionId: "version-1",
      questionKey: "first",
      questionOrder: 1,
      prompt: "What would you like your English to help with at work?",
      answerType: "single_select",
      config: {
        type: "single_select",
        label: "Choose the closest fit",
        options: [
          { id: "meetings", label: "Speaking in meetings" },
          { id: "writing", label: "Writing clearly" },
        ],
      },
    },
    {
      id: "q-2",
      versionId: "version-1",
      questionKey: "second",
      questionOrder: 2,
      prompt: "What kind of work conversations come up most often?",
      answerType: "short_text",
      config: {
        type: "short_text",
        label: "Work context",
        maxLength: 160,
      },
    },
  ],
  answers: [],
  savedAnswers: {
    "q-1": { type: "single_select", optionId: "meetings" },
  },
};

describe("OnboardingPage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getClientOnboardingDataMock.mockReset();
  });

  it("redirects signed-out visitors to login", async () => {
    getClientOnboardingDataMock.mockResolvedValueOnce(null);

    await expect(OnboardingPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects coaches to the coach home", async () => {
    getClientOnboardingDataMock.mockResolvedValueOnce({
      role: "coach",
      onboarding: null,
    });

    await expect(OnboardingPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/coach");
  });

  it("renders the approved empty state when no active assessment exists", async () => {
    getClientOnboardingDataMock.mockResolvedValueOnce({
      role: "client",
      onboarding: null,
    });

    const Page = await OnboardingPage();
    render(Page);

    expect(screen.getByText("Nothing to answer yet")).toBeInTheDocument();
    expect(
      screen.getByText("Your coach will add the next step when it is ready.")
    ).toBeInTheDocument();
  });

  it("renders one current question and persisted resume reassurance", async () => {
    getClientOnboardingDataMock.mockResolvedValueOnce({
      role: "client",
      onboarding: onboardingData,
    });

    const Page = await OnboardingPage();
    const { container } = render(Page);

    expect(
      screen.getByText("Let's get your coach a little context")
    ).toBeInTheDocument();
    expect(
      screen.getByText("What kind of work conversations come up most often?")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("What would you like your English to help with at work?")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Speaking in meetings")).toBeInTheDocument();
    expect(
      screen.getByText("We saved your answers. You can continue when you are ready.")
    ).toBeInTheDocument();
    expect(primaryActionCount(container)).toBe(1);
  });

  it("does not render assessment chooser, gallery, or judgement language", async () => {
    getClientOnboardingDataMock.mockResolvedValueOnce({
      role: "client",
      onboarding: onboardingData,
    });

    const Page = await OnboardingPage();
    const { container } = render(Page);

    expect(container.textContent).not.toMatch(
      /choose an assessment|pick an assessment|gallery|score|grade|placement|recommendation|streak/i
    );
    expect(container.textContent).not.toContain("%");
  });

  it("imports the required data helper, actions, and conversation component", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");

    expect(pageSource).toContain("getClientOnboardingData");
    expect(pageSource).toContain("OnboardingConversation");
    expect(pageSource).toContain("saveOnboardingAnswerAction");
    expect(pageSource).toContain("finalizeOnboardingAttemptAction");
  });
});
