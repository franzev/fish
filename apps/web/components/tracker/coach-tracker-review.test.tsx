import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CoachTrackerReviewData } from "@/lib/services";
import { CoachTrackerReview } from "./coach-tracker-review";

const review: CoachTrackerReviewData = {
  assignmentId: "assignment-1",
  status: "saved",
  entries: [
    {
      entryDate: "2026-07-05",
      fields: [
        {
          id: "entry-1",
          fieldId: "field-1",
          fieldKey: "practice_moment",
          fieldOrder: 1,
          fieldPrompt: "Did you have a moment for English today?",
          config: {
            type: "boolean",
            label: "Practice moment",
            options: [
              { id: "yes", label: "Yes" },
              { id: "not_today", label: "Not today" },
            ],
          },
          answer: { type: "boolean", value: true },
          updatedAt: "2026-07-05T01:00:00.000Z",
        },
        {
          id: "entry-2",
          fieldId: "field-2",
          fieldKey: "support",
          fieldOrder: 2,
          fieldPrompt: "What helped today?",
          config: {
            type: "multi_select",
            label: "Support",
            options: [
              { id: "example", label: "A clear example" },
              { id: "quiet", label: "Quiet time" },
            ],
          },
          answer: { type: "multi_select", optionIds: ["example", "quiet"] },
          updatedAt: "2026-07-05T01:02:00.000Z",
        },
      ],
    },
  ],
};

describe("CoachTrackerReview", () => {
  it("renders a calm empty state without actions", () => {
    render(<CoachTrackerReview review={null} />);

    expect(screen.getByText("No tracker entries yet")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("formats saved entries and stays read-only", () => {
    const { container } = render(<CoachTrackerReview review={review} />);

    expect(screen.getByText("Tracker entries")).toBeInTheDocument();
    expect(screen.getByText("2026-07-05")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("A clear example, Quiet time")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/score|grade|streak|%/i);
  });
});
