import { describe, expect, it } from "vitest";
import { deriveRowPresentation } from "./row-presentation";
import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";

function message(overrides: Partial<LocalMessage> = {}): LocalMessage {
  return {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: "client-1",
    senderRole: "client",
    body: "Hello",
    clientRequestId: "request-1",
    createdAt: "2026-07-19T01:00:00.000Z",
    localStatus: "sent",
    ...overrides,
  };
}

const context = {
  currentUserId: "client-1",
  isCommunity: false,
  latestMineRequestId: "request-1",
  isEditing: false,
};

describe("deriveRowPresentation", () => {
  it("shows a direct received avatar at the end of a group", () => {
    const current = message({ senderId: "coach-1", senderRole: "coach" });
    const next = message({ id: "message-2", senderId: "client-1" });
    expect(deriveRowPresentation(current, undefined, next, context).showParticipantAvatar).toBe(true);
  });

  it("starts a community group at a sender boundary or reply", () => {
    const current = message({ senderId: "coach-1", senderRole: "coach" });
    const previous = message({ senderId: "coach-1", senderRole: "coach" });
    const reply = message({ id: "reply-1", senderId: "client-1" });
    expect(
      deriveRowPresentation(current, previous, undefined, {
        ...context,
        isCommunity: true,
        replyMessage: reply,
      }).startsCommunityGroup
    ).toBe(true);
  });

  it("adds a divider when the local calendar day changes", () => {
    const previous = message({ createdAt: "2026-07-18T15:59:59.999Z" });
    const current = message({ createdAt: "2026-07-18T16:00:00.000Z" });
    expect(deriveRowPresentation(current, previous, undefined, context).dayDividerLabel).toBe(
      "Today"
    );
  });

  it("derives media widths without embedding layout branching in the row", () => {
    const current = message({
      attachments: [
        {
          id: "image-1",
          status: "ready",
          kind: "image",
          originalName: "photo.png",
          mimeType: "image/png",
          byteSize: 10,
          displayPath: "photo.png",
        },
      ],
    });
    expect(deriveRowPresentation(current, undefined, undefined, context).surfaceWidthClass).toBe(
      "w-full max-w-chat-preview"
    );
  });
});
