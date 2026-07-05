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

const {
  getCoachClientDetailDataMock,
  getCoachClientOnboardingReviewDataMock,
} = vi.hoisted(() => ({
  getCoachClientDetailDataMock: vi.fn(),
  getCoachClientOnboardingReviewDataMock: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  getCoachClientDetailData: getCoachClientDetailDataMock,
  getCoachClientOnboardingReviewData: getCoachClientOnboardingReviewDataMock,
}));

import CoachClientDetailPage from "./page";

describe("CoachClientDetailPage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getCoachClientDetailDataMock.mockReset();
    getCoachClientOnboardingReviewDataMock.mockReset();
  });

  it("redirects to signed-out when there is no session", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce(null);

    await expect(
      CoachClientDetailPage({ params: Promise.resolve({ id: "some-id" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("silently forwards a client to /home (wrong door)", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "client",
      client: null,
    });

    await expect(
      CoachClientDetailPage({ params: Promise.resolve({ id: "some-id" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/home");
  });

  it("renders the calm not-found notice when the client is unassigned/missing, never an error tone", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "coach",
      client: null,
    });

    const Page = await CoachClientDetailPage({
      params: Promise.resolve({ id: "guessed-uuid" }),
    });
    render(Page);

    expect(
      screen.getByText(/couldn.t find that client/i)
    ).toBeInTheDocument();
    expect(getCoachClientOnboardingReviewDataMock).not.toHaveBeenCalled();
    // The calm Alert renders as border-only styling, no error/red tone --
    // assert no "error"/"couldn't be found" harsh copy leaked in.
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("renders identity + goal + level as a plain label, never a grade/percentage", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "coach",
      client: {
        displayName: "Alex Rivera",
        goal: "Speak confidently in team meetings",
        level: "B1",
      },
    });
    getCoachClientOnboardingReviewDataMock.mockResolvedValueOnce({
      role: "coach",
      review: null,
    });

    const Page = await CoachClientDetailPage({
      params: Promise.resolve({ id: "assigned-id" }),
    });
    render(Page);

    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(
      screen.getByText("Speak confidently in team meetings")
    ).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.getByText("No onboarding answers yet")).toBeInTheDocument();
    // Plain label, not a percentage/grade string.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/grade/i)).not.toBeInTheDocument();
  });

  it("hides a11y prefs and consent (D-10) and has no primary button (read-only)", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "coach",
      client: {
        displayName: "Alex Rivera",
        goal: "Speak confidently in team meetings",
        level: "B1",
      },
    });
    getCoachClientOnboardingReviewDataMock.mockResolvedValueOnce({
      role: "coach",
      review: {
        attemptId: "attempt-1",
        status: "submitted",
        submittedAt: "2026-07-05T03:00:00.000Z",
        answers: [
          {
            id: "a-1",
            questionId: "q-1",
            questionKey: "first",
            questionOrder: 1,
            questionPrompt: "What should English help with first?",
            config: {
              type: "single_select",
              label: "Choose one",
              options: [
                { id: "meetings", label: "Speaking in meetings" },
                { id: "writing", label: "Writing clearly" },
              ],
            },
            answer: { type: "single_select", optionId: "meetings" },
            answeredAt: "2026-07-05T03:00:00.000Z",
          },
        ],
      },
    });

    const Page = await CoachClientDetailPage({
      params: Promise.resolve({ id: "assigned-id" }),
    });
    render(Page);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/reduced motion/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/agreement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/consent/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score|grade|placement|recommendation|%/i)).not.toBeInTheDocument();
  });

  it("renders submitted onboarding answers for an assigned client", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "coach",
      client: {
        displayName: "Alex Rivera",
        goal: "Speak confidently in team meetings",
        level: "B1",
      },
    });
    getCoachClientOnboardingReviewDataMock.mockResolvedValueOnce({
      role: "coach",
      review: {
        attemptId: "attempt-1",
        status: "submitted",
        submittedAt: "2026-07-05T03:00:00.000Z",
        answers: [
          {
            id: "a-1",
            questionId: "q-1",
            questionKey: "first",
            questionOrder: 1,
            questionPrompt: "What should English help with first?",
            config: {
              type: "single_select",
              label: "Choose one",
              options: [
                { id: "meetings", label: "Speaking in meetings" },
                { id: "writing", label: "Writing clearly" },
              ],
            },
            answer: { type: "single_select", optionId: "meetings" },
            answeredAt: "2026-07-05T03:00:00.000Z",
          },
        ],
      },
    });

    const Page = await CoachClientDetailPage({
      params: Promise.resolve({ id: "assigned-id" }),
    });
    render(Page);

    expect(screen.getByText("Onboarding answers")).toBeInTheDocument();
    expect(
      screen.getByText("What should English help with first?")
    ).toBeInTheDocument();
    expect(screen.getByText("Speaking in meetings")).toBeInTheDocument();
    expect(getCoachClientOnboardingReviewDataMock).toHaveBeenCalledWith(
      "assigned-id"
    );
  });

  it("renders partial onboarding state inline with no write controls", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "coach",
      client: {
        displayName: "Alex Rivera",
        goal: "Speak confidently in team meetings",
        level: "B1",
      },
    });
    getCoachClientOnboardingReviewDataMock.mockResolvedValueOnce({
      role: "coach",
      review: {
        attemptId: "attempt-1",
        status: "in_progress",
        submittedAt: null,
        answers: [
          {
            id: "a-1",
            questionId: "q-1",
            questionKey: "first",
            questionOrder: 1,
            questionPrompt: "What should English help with first?",
            config: {
              type: "short_text",
              label: "Work context",
            },
            answer: { type: "short_text", value: "Customer calls" },
            answeredAt: "2026-07-05T03:00:00.000Z",
          },
        ],
      },
    });

    const Page = await CoachClientDetailPage({
      params: Promise.resolve({ id: "assigned-id" }),
    });
    const { container } = render(Page);

    expect(screen.getByText("Answers are still in progress")).toBeInTheDocument();
    expect(screen.getByText("Customer calls")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("calls getCoachClientDetailData and does not hand-write an id/coach_id filter (RLS is the boundary)", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    expect(pageSource).toMatch(/getCoachClientDetailData/);
    expect(pageSource).toMatch(/getCoachClientOnboardingReviewData/);
    expect(pageSource).toMatch(/CoachOnboardingReview/);
    expect(pageSource).toMatch(/Alert tone="notice"/);
    expect(pageSource).not.toMatch(/\.eq\("coach_id"/);
    expect(pageSource).not.toMatch(/\.eq\("id"/);
  });
});
