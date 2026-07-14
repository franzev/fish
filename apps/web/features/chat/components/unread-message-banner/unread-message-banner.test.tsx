import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnreadMessageBanner } from "./unread-message-banner";

afterEach(() => {
  delete document.documentElement.dataset.timeFormat;
});

describe("UnreadMessageBanner", () => {
  it("shows the exact plural count and oldest unread time", () => {
    document.documentElement.dataset.timeFormat = "12h";
    const oldestUnreadAt = new Date(2026, 6, 14, 7, 25).toISOString();

    render(
      <UnreadMessageBanner
        count={11}
        oldestUnreadAt={oldestUnreadAt}
        onMarkRead={vi.fn()}
      />
    );

    expect(screen.getByText("11 new messages since 7:25 AM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeEnabled();
  });

  it("uses singular copy and invokes the one acknowledgment action", () => {
    const onMarkRead = vi.fn();
    render(
      <UnreadMessageBanner
        count={1}
        oldestUnreadAt={null}
        onMarkRead={onMarkRead}
      />
    );

    expect(screen.getByText("1 new message")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("stacks without covering the transcript and becomes compact on wider screens", () => {
    render(
      <UnreadMessageBanner
        count={2}
        oldestUnreadAt={null}
        onMarkRead={vi.fn()}
      />
    );

    const banner = screen.getByRole("region", { name: "Unread messages" });
    const layout = banner.firstElementChild;
    const button = screen.getByRole("button", { name: "Mark as read" });

    expect(banner).toHaveClass(
      "mx-md",
      "shrink-0",
      "rounded-b-control",
      "bg-surface-2",
      "px-sm"
    );
    expect(banner).not.toHaveClass(
      "absolute",
      "inset-x-0",
      "top-0",
      "z-10",
      "rounded-control"
    );
    expect(layout).toHaveClass(
      "flex-col",
      "items-start",
      "py-xs",
      "md:min-h-search-control",
      "md:flex-row",
      "md:items-center",
      "md:justify-between",
      "md:py-0"
    );
    expect(button).toHaveClass(
      "bg-transparent",
      "text-muted",
      "hover:text-body",
      "text-ui-xs",
      "md:min-h-search-control"
    );
    expect(button).not.toHaveClass("hover:bg-surface-3");
  });

  it("explains a failed acknowledgment calmly", () => {
    render(
      <UnreadMessageBanner
        count={2}
        oldestUnreadAt={null}
        notice="Messages weren’t marked as read. Try again."
        onMarkRead={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Mark as read" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Messages weren’t marked as read. Try again."
    );
  });

  it("renders nothing when there are no unread messages", () => {
    const { container } = render(
      <UnreadMessageBanner
        count={0}
        oldestUnreadAt={null}
        onMarkRead={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
