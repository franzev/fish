import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountBadge } from "./count-badge";

describe("CountBadge", () => {
  it("uses one content-aware pill treatment for short and capped counts", () => {
    const { rerender } = render(<CountBadge count={12} aria-label="12 unread" />);
    const badge = screen.getByLabelText("12 unread");

    expect(badge).toHaveTextContent("12");
    expect(badge.className).not.toContain("h-badge");
    expect(badge.className).toContain("min-w-badge");
    expect(badge.className).toContain("px-3xs");
    expect(badge.className).toContain("py-3xs");
    expect(badge.className).toContain("rounded-pill");
    expect(badge.className).toContain("text-ui-3xs");
    expect(badge.className).toContain("text-on-primary");

    rerender(<CountBadge count={120} aria-label="120 unread" />);
    expect(screen.getByLabelText("120 unread")).toHaveTextContent("99+");
  });

  it("supports a semantic prefix and omits empty counts", () => {
    const { rerender } = render(<CountBadge count={3} prefix="@" />);
    expect(screen.getByText("@3")).toBeInTheDocument();

    rerender(<CountBadge count={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
