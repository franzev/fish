import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnreadDivider } from "./unread-divider";

describe("UnreadDivider", () => {
  it("renders the existing accessible new-message boundary", () => {
    render(<UnreadDivider data-testid="unread-divider" className="mt-md" />);

    const divider = screen.getByRole("separator", { name: "Unread messages" });
    expect(divider).toHaveTextContent("New");
    expect(divider).toHaveAttribute("data-testid", "unread-divider");
    expect(divider).toHaveClass("mt-md");
  });

  it("combines a coincident date boundary into the same separator", () => {
    render(<UnreadDivider dateLabel="July 13, 2026" />);

    const divider = screen.getByRole("separator", { name: "Unread messages" });
    expect(within(divider).getByText("July 13, 2026")).toBeVisible();
    expect(within(divider).getByText("New")).toBeVisible();
    expect(divider).toHaveAccessibleDescription("July 13, 2026");
  });
});
