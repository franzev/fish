import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, Progress } from "./card";

describe("Card", () => {
  it("renders the elevated surface tokens including the shadow-card elevation", () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-card");
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("shadow-[var(--shadow-card)]");
  });
});

describe("Progress", () => {
  it("renders the ARIA progressbar triad and a value-driven fill width", () => {
    const { getByRole } = render(<Progress value={40} label="Step 2 of 5" />);
    const bar = getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    const fill = bar.firstChild as HTMLElement;
    expect(fill.style.width).toBe("40%");
  });

  it("never renders a bare numeric percentage as a judgement", () => {
    const { queryByText } = render(<Progress value={40} label="Step 2 of 5" />);
    expect(queryByText("40%")).toBeNull();
  });
});
