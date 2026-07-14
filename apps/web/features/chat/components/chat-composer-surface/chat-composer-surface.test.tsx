import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import type { ClientChatData } from "@/lib/services";
import { ChatComposerSurface } from "./chat-composer-surface";

const chat = {
  channelName: "general",
  currentUserId: "user-1",
} as ClientChatData;

function props() {
  return {
    chat,
    isOffline: false,
    notice: null,
    replyingTo: null,
    editingMessage: null,
    draft: "",
    canSend: false,
    getMessageAuthorName: () => "Coach",
    cancelReply: vi.fn(),
    handleDraftChange: vi.fn(),
    handleSend: vi.fn(async () => undefined),
    handleComposerKeyDown: vi.fn(),
    stopLocalTyping: vi.fn(),
    scrollToBottom: vi.fn(),
    images: [],
    imageNotice: null,
    addImages: vi.fn(),
    removeImage: vi.fn(),
    retryImage: vi.fn(),
    selectedGif: null,
    selectGif: vi.fn(),
    removeSelectedGif: vi.fn(),
    selectedStickerId: null,
    selectSticker: vi.fn(),
    removeSelectedSticker: vi.fn(),
  };
}

describe("ChatComposerSurface stickers", () => {
  it("selects the bundled sticker id without creating an attachment", () => {
    const viewProps = props();
    render(<ChatComposerSurface {...viewProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add emoji, GIF, or sticker" }));
    fireEvent.click(screen.getByRole("tab", { name: "Stickers" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Thank you sticker" }));

    expect(viewProps.selectSticker).toHaveBeenCalledWith("aquatic-thank-you-octopus");
    expect(viewProps.addImages).not.toHaveBeenCalled();
  });

  it("quiets the composer while a message is edited inline", () => {
    const viewProps = props();
    render(
      <ChatComposerSurface
        {...viewProps}
        draft="A message to revise"
        canSend
        editingMessage={{ id: "message-1" } as LocalMessage}
      />
    );

    expect(
      screen.getByText("Finish editing the message above")
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Message" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
  });
});
