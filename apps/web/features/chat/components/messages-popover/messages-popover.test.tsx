import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MessagePopoverActionState } from "@/features/chat/contracts";
import { MessagesPopover } from "./messages-popover";

function previewResult(): MessagePopoverActionState {
  return {
    status: "sent",
    values: { conversationId: "11111111-1111-4111-8111-111111111111" },
    preview: {
      conversationId: "11111111-1111-4111-8111-111111111111",
      participant: {
        id: "coach-1",
        displayName: "Coach Dana",
      },
      latestMessage: {
        senderId: "coach-1",
        text: "How did practice feel today?",
        createdAt: "2026-07-14T08:33:00.000Z",
      },
    },
  };
}

describe("MessagesPopover", () => {
  it("opens a desktop inbox preview with filters, count, and page controls", async () => {
    const loadPreviewAction = vi.fn(async () => previewResult());
    render(
      <MessagesPopover
        conversationId="11111111-1111-4111-8111-111111111111"
        unreadCount={3}
        loadPreviewAction={loadPreviewAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Messages, 3 unread" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Messages" })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "All" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(dialog).getByRole("tab", { name: "Unread" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("tab", { name: "Archived" })).toBeNull();
    expect(within(dialog).getByRole("link", { name: "Open messages" })).toHaveAttribute(
      "href",
      "/messages"
    );
    expect(within(dialog).getByRole("button", { name: "Close messages" })).toBeInTheDocument();

    await waitFor(() => expect(loadPreviewAction).toHaveBeenCalledWith({
      conversationId: "11111111-1111-4111-8111-111111111111",
    }));
    expect(await within(dialog).findByRole("link", { name: /Coach Dana/ })).toHaveAttribute(
      "href",
      "/messages/11111111-1111-4111-8111-111111111111"
    );
    expect(within(dialog).getByText("How did practice feel today?")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("3 unread")).toBeInTheDocument();
  });

  it("shows a calm caught-up state in the Unread filter", async () => {
    render(
      <MessagesPopover
        conversationId="11111111-1111-4111-8111-111111111111"
        unreadCount={0}
        loadPreviewAction={vi.fn(async () => previewResult())}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Messages" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("link", { name: /Coach Dana/ });
    fireEvent.click(within(dialog).getByRole("tab", { name: "Unread" }));

    expect(within(dialog).getByText("No unread messages")).toBeInTheDocument();
    expect(within(dialog).getByText("You’re all caught up.")).toBeInTheDocument();
  });

  it("keeps direct navigation when preview data is unavailable", () => {
    render(
      <MessagesPopover conversationId={null} unreadCount={2} />
    );

    expect(screen.getByRole("link", { name: "Messages, 2 unread" })).toHaveAttribute(
      "href",
      "/messages"
    );
    expect(screen.queryByRole("button", { name: "Messages, 2 unread" })).toBeNull();
  });
});
