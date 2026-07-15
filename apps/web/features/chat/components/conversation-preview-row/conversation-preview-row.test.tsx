import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationPreviewRow } from "./conversation-preview-row";

describe("ConversationPreviewRow", () => {
  it("preserves navigation, active state, preview, and unread context", () => {
    const onNavigate = vi.fn();
    render(
      <ConversationPreviewRow
        href="/messages/conversation-1"
        participant={{ id: "coach-1", displayName: "Gwyn" }}
        preview="How did practice feel?"
        latestMessageAt="2026-07-14T08:33:00.000Z"
        unreadCount={3}
        active
        presentation="rail"
        onNavigate={onNavigate}
      />
    );

    const link = screen.getByRole("link", { name: /Gwyn/ });
    expect(link).toHaveAttribute("href", "/messages/conversation-1");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("items-center");
    expect(screen.getByText("How did practice feel?")).toBeVisible();
    expect(screen.getByLabelText("3 unread")).toBeVisible();
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
