import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FieldAnswer, OnboardingQuestion } from "@fish/core";
import { AutosaveStatus } from "./autosave-status";
import { OnboardingConversation } from "./onboarding-conversation";

const questions: OnboardingQuestion[] = [
  {
    id: "q-1",
    questionKey: "first",
    questionOrder: 1,
    prompt: "What would you like your English to help with at work?",
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
    questionKey: "second",
    questionOrder: 2,
    prompt: "What kind of work conversations come up most often?",
    config: {
      type: "short_text",
      label: "Work context",
      maxLength: 160,
      placeholder: "Team updates",
    },
  },
];

const savedAnswers: Record<string, FieldAnswer> = {
  "q-1": { type: "single_select", optionId: "meetings" },
};

function primaryCount(container: HTMLElement): number {
  return Array.from(container.querySelectorAll("button")).filter((button) =>
    button.className.includes("bg-primary")
  ).length;
}

describe("AutosaveStatus", () => {
  it("renders the approved stable status copy", () => {
    const statuses = [
      "Saving...",
      "Saved",
      "We saved your answers. You can continue when you are ready.",
      "That did not save yet. Keep this open and try again.",
      "You are offline. We will save when you are back.",
    ];

    for (const statusText of statuses) {
      const { unmount } = render(
        <AutosaveStatus statusText={statusText} />
      );
      const region = screen.getByRole("status");
      expect(region).toHaveTextContent(statusText);
      expect(region.className).toContain("min-h-field-message");
      unmount();
    }
  });
});

describe("OnboardingConversation", () => {
  it("shows one current system question and prior saved answers as client bubbles", () => {
    render(
      <OnboardingConversation
        questions={questions}
        savedAnswers={savedAnswers}
        currentQuestionId="q-2"
        attemptStatus="in_progress"
        autosaveStatus="resume"
        onSaveAnswer={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    expect(
      screen.getByText("What kind of work conversations come up most often?")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("What would you like your English to help with at work?")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Speaking in meetings")).toBeInTheDocument();
    expect(screen.getAllByText("Question 2 of 2")).toHaveLength(2);
    expect(screen.queryByText(/choose an assessment/i)).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps active question states to at most one primary action", () => {
    const { container } = render(
      <OnboardingConversation
        questions={questions}
        savedAnswers={savedAnswers}
        currentQuestionId="q-2"
        attemptStatus="in_progress"
        autosaveStatus="saved"
        onSaveAnswer={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    expect(primaryCount(container)).toBeLessThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Save answer" })).toBeInTheDocument();
  });

  it("shows one final primary action after all answers are saved", () => {
    const { container } = render(
      <OnboardingConversation
        questions={questions}
        savedAnswers={{
          ...savedAnswers,
          "q-2": { type: "short_text", value: "Customer calls" },
        }}
        attemptStatus="in_progress"
        autosaveStatus="saved"
        onSaveAnswer={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    expect(screen.getByText("Your answers are ready for your coach")).toBeInTheDocument();
    expect(screen.getByText("They will guide what comes next.")).toBeInTheDocument();
    expect(primaryCount(container)).toBe(1);
    expect(
      screen.getByRole("button", { name: "Share with coach" })
    ).toBeInTheDocument();
  });

  it("does not render judgement or picker copy", () => {
    const { container } = render(
      <OnboardingConversation
        questions={questions}
        savedAnswers={savedAnswers}
        currentQuestionId="q-2"
        attemptStatus="in_progress"
        autosaveStatus="offline"
        onSaveAnswer={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    expect(container.textContent).not.toMatch(
      /score|grade|streak|placement|recommendation|%/i
    );
  });

  it("uses a polite status region near the current question", () => {
    render(
      <OnboardingConversation
        questions={questions}
        savedAnswers={savedAnswers}
        currentQuestionId="q-2"
        attemptStatus="in_progress"
        autosaveStatus="offline"
        onSaveAnswer={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("You are offline. We will save when you are back.");
    expect(status.className).toContain("min-h-field-message");
    expect(within(status).queryByRole("button")).toBeNull();
  });
});
