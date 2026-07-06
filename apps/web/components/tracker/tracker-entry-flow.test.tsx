import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientTrackerField, TrackerProgress } from "@/lib/services";
import { TrackerEntryFlow } from "./tracker-entry-flow";

const fields: ClientTrackerField[] = [
  {
    id: "field-1",
    versionId: "version-1",
    fieldKey: "practice_moment",
    fieldOrder: 1,
    prompt: "Did you have a moment for English today?",
    answerType: "boolean",
    config: {
      type: "boolean",
      label: "Practice moment",
      options: [
        { id: "yes", label: "Yes" },
        { id: "not_today", label: "Not today" },
      ],
    },
  },
  {
    id: "field-2",
    versionId: "version-1",
    fieldKey: "reflection",
    fieldOrder: 2,
    prompt: "Anything you want your coach to know?",
    answerType: "long_text",
    config: {
      type: "long_text",
      label: "Reflection",
      maxLength: 120,
    },
  },
];

const progress: TrackerProgress = {
  entriesCount: 0,
  steps: [
    {
      id: "milestone-1",
      label: "Log your first entry",
      state: "now",
      currentStepProgress: 0,
    },
    {
      id: "milestone-2",
      label: "Share three entries with your coach",
      state: "up_next",
      currentStepProgress: 0,
    },
  ],
};

describe("TrackerEntryFlow", () => {
  it("renders one primary save action and no nested field submit buttons", () => {
    const { container } = render(
      <TrackerEntryFlow
        trackerName="Daily check-in"
        coachDisplayName="Coach Mina"
        fields={fields}
        answers={{}}
        progress={progress}
        onAnswerChange={vi.fn()}
        onSaveEntry={vi.fn()}
      />
    );

    expect(screen.getByText("Your path")).toBeInTheDocument();
    expect(
      screen.getByText("Coach Mina adds each step as you're ready.")
    ).toBeInTheDocument();
    expect(screen.getByText("Daily check-in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save entry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save answer" })).toBeNull();
    expect(container.querySelectorAll("button.bg-primary")).toHaveLength(1);
  });

  it("keeps field changes local and commits through the single action", async () => {
    const onAnswerChange = vi.fn();
    const onSaveEntry = vi.fn();

    render(
      <TrackerEntryFlow
        trackerName="Daily check-in"
        coachDisplayName="Coach Mina"
        fields={fields}
        answers={{}}
        progress={progress}
        onAnswerChange={onAnswerChange}
        onSaveEntry={onSaveEntry}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onAnswerChange).toHaveBeenCalledWith("field-1", {
      type: "boolean",
      value: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    expect(onSaveEntry).toHaveBeenCalledOnce();
  });
});
