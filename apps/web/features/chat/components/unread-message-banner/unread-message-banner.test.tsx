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

  it("uses a compact desktop footprint while preserving the mobile touch target", () => {
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

    expect(banner).toHaveClass("mt-2xs", "rounded-control", "px-sm");
    expect(layout).toHaveClass("min-h-control", "sm:min-h-search-control");
    expect(button).toHaveClass(
      "bg-transparent",
      "text-muted",
      "hover:text-body",
      "text-ui-xs",
      "sm:min-h-search-control"
    );
    expect(button).not.toHaveClass("hover:bg-surface-3");
  });

  it("stays layout-stable and explains a failed acknowledgment calmly", () => {
    render(
      <UnreadMessageBanner
        count={2}
        oldestUnreadAt={null}
        loading
        notice="Messages weren’t marked as read. Try again."
        onMarkRead={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Mark as read" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark as read" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
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
