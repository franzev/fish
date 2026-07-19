import { describe, expect, it } from "vitest";
import { resolveMessageAuthor } from "./author-identity";

const message = {
  id: "message-1",
  conversationId: "conversation-1",
  senderId: "member-1",
  senderRole: "client" as const,
  body: "hello",
  clientRequestId: "request-1",
  createdAt: "2026-07-14T01:00:00.000Z",
};

const directChat = {
  conversationId: "conversation-1",
  currentUserId: "coach-1",
  currentUserRole: "coach" as const,
  currentUserDisplayName: "Coach",
  participant: { id: "member-1", displayName: "Alex", role: "client" as const },
  messages: [],
};

describe("message author identity", () => {
  it("uses the direct participant fallback", () => {
    expect(resolveMessageAuthor(message, directChat, [])).toMatchObject({
      displayName: "Alex",
      role: "client",
    });
  });

  it("uses a directory member for community identity", () => {
    expect(resolveMessageAuthor(
      { ...message, senderDisplayName: null },
      { ...directChat, kind: "community", channelId: "channel-1" },
      [{ id: "member-1", displayName: "Sam", username: "sam", avatarUrl: "avatar" }]
    )).toEqual({
      id: "member-1",
      displayName: "Member",
      username: "sam",
      role: "client",
      avatarUrl: "avatar",
    });
  });
});
