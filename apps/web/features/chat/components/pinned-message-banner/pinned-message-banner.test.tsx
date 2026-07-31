import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PinnedMessageBanner } from "./pinned-message-banner";

describe("PinnedMessageBanner", () => {
  it("renders nothing when there is no pinned message", () => {
    const { container } = render(
      <PinnedMessageBanner message={null} onFocus={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the pinned message has no visible text", () => {
    const { container } = render(
      <PinnedMessageBanner message={{ body: "   " }} onFocus={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the pinned snippet and fires the focus callback on click", () => {
    const onFocus = vi.fn();
    render(
      <PinnedMessageBanner
        message={{ body: "Keep this phrase handy" }}
        onFocus={onFocus}
      />
    );

    const button = screen.getByRole("button", {
      name: "Pinned message: Keep this phrase handy",
    });
    expect(button).toBeVisible();
    expect(button).toHaveTextContent("Keep this phrase handy");

    fireEvent.click(button);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("keeps a single-line truncated snippet for long pinned text", () => {
    const longBody = "This is a very long pinned phrase ".repeat(10).trim();
    render(<PinnedMessageBanner message={{ body: longBody }} onFocus={vi.fn()} />);

    const snippet = screen.getByText(longBody);
    expect(snippet).toHaveClass("truncate");
    const button = snippet.closest("button");
    expect(button).not.toBeNull();
    expect(button?.className).not.toMatch(/\bwrap\b/);
  });
});
