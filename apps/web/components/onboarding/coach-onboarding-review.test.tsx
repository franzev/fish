import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import type { CoachOnboardingReviewData } from "@/lib/services";
import { CoachOnboardingReview } from "./coach-onboarding-review";

const sixTypeReview: CoachOnboardingReviewData = {
  attemptId: "attempt-1",
  status: "submitted",
  submittedAt: "2026-07-05T03:00:00.000Z",
  answers: [
    {
      id: "a-2",
      questionId: "q-2",
      questionKey: "multi",
      questionOrder: 2,
      questionPrompt: "Which situations happen often?",
      config: {
        type: "multi_select",
        label: "Choose what fits",
        options: [
          { id: "email", label: "Email updates" },
          { id: "calls", label: "Client calls" },
          { id: "chat", label: "Team chat" },
        ],
      },
      answer: { type: "multi_select", optionIds: ["calls", "chat"] },
      answeredAt: "2026-07-05T03:01:00.000Z",
    },
    {
      id: "a-1",
      questionId: "q-1",
      questionKey: "single",
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
    {
      id: "a-3",
      questionId: "q-3",
      questionKey: "scale",
      questionOrder: 3,
      questionPrompt: "How does that feel today?",
      config: {
        type: "scale",
        label: "Choose the closest fit",
        options: [
          { id: "needs_support", label: "Needs support" },
          { id: "mostly_okay", label: "Mostly okay" },
        ],
      },
      answer: { type: "scale", value: "mostly_okay" },
      answeredAt: "2026-07-05T03:02:00.000Z",
    },
    {
      id: "a-4",
      questionId: "q-4",
      questionKey: "short",
      questionOrder: 4,
      questionPrompt: "What is the work context?",
      config: { type: "short_text", label: "Work context" },
      answer: { type: "short_text", value: "Customer calls" },
      answeredAt: "2026-07-05T03:03:00.000Z",
    },
    {
      id: "a-5",
      questionId: "q-5",
      questionKey: "long",
      questionOrder: 5,
      questionPrompt: "What would help your coach understand?",
      config: { type: "long_text", label: "More context" },
      answer: {
        type: "long_text",
        value: "I need time to find words before I answer.",
      },
      answeredAt: "2026-07-05T03:04:00.000Z",
    },
    {
      id: "a-6",
      questionId: "q-6",
      questionKey: "boolean",
      questionOrder: 6,
      questionPrompt: "Would written notes help?",
      config: {
        type: "boolean",
        label: "Written notes",
        options: [
          { id: "yes", label: "Yes" },
          { id: "not_now", label: "Not right now" },
        ],
      },
      answer: { type: "boolean", value: false },
      answeredAt: "2026-07-05T03:05:00.000Z",
    },
  ],
};

describe("CoachOnboardingReview", () => {
  it("renders the calm empty state with no actions", () => {
    render(<CoachOnboardingReview review={null} />);

    expect(screen.getByText("No onboarding answers yet")).toBeInTheDocument();
    expect(
      screen.getByText("When this client starts, their answers will appear here.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders partial state copy with saved answers in order", () => {
    render(
      <CoachOnboardingReview
        review={{
          ...sixTypeReview,
          status: "in_progress",
          submittedAt: null,
          answers: sixTypeReview.answers.slice(0, 2),
        }}
      />
    );

    expect(screen.getByText("Answers are still in progress")).toBeInTheDocument();
    expect(
      screen.getByText("Review what has been saved so far. Nothing needs action yet.")
    ).toBeInTheDocument();

    const prompts = screen.getAllByRole("heading", { level: 3 });
    expect(prompts.map((heading) => heading.textContent)).toEqual([
      "What should English help with first?",
      "Which situations happen often?",
    ]);
  });

  it("formats all six answer types from pinned snapshots", () => {
    render(<CoachOnboardingReview review={sixTypeReview} />);

    expect(screen.getByText("Speaking in meetings")).toBeInTheDocument();
    expect(screen.getByText("Client calls, Team chat")).toBeInTheDocument();
    expect(screen.getByText("Mostly okay")).toBeInTheDocument();
    expect(screen.getByText("Customer calls")).toBeInTheDocument();
    expect(
      screen.getByText("I need time to find words before I answer.")
    ).toBeInTheDocument();
    expect(screen.getByText("Not right now")).toBeInTheDocument();
  });

  it("stays read-only and avoids judgement copy", () => {
    const { container } = render(<CoachOnboardingReview review={sixTypeReview} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.textContent).not.toMatch(
      /score|grade|placement|recommendation|streak|%/i
    );
  });

  it("exports no editable control source", () => {
    const source = readFileSync(
      resolve(__dirname, "./coach-onboarding-review.tsx"),
      "utf-8"
    );

    expect(source).toContain("export function CoachOnboardingReview");
    expect(source).toContain("No onboarding answers yet");
    expect(source).toContain("Answers are still in progress");
    expect(source).not.toMatch(/Button|variant="primary"|<input|<textarea/);
  });
});
