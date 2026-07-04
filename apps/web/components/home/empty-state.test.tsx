import { render, screen } from "@testing-library/react";
import { IconMoodHappy } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the passed icon (aria-hidden) and the calm copy children", () => {
    const { container } = render(
      <EmptyState Icon={IconMoodHappy}>Nothing here yet.</EmptyState>
    );

    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("contains zero buttons or primary actions — reassurance only (D-18)", () => {
    render(<EmptyState Icon={IconMoodHappy}>Nothing here yet.</EmptyState>);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
