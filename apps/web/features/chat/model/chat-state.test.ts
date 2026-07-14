import { describe, expect, it } from "vitest";
import {
  countUnreadMessages,
  getUnreadMessageSummary,
  getOutgoingMessageStatus,
  mergeChatMessage,
  toReplyPreview,
} from "./chat-state";
import type { ClientChatMessage, ClientChatReadState } from "@/lib/services";

const baseMessage = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  senderRole: "client" as const,
  createdAt: "2026-07-06T04:00:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  reactions: [],
};

function message(
  overrides: Partial<ClientChatMessage> & Pick<ClientChatMessage, "id" | "senderId" | "body">
): ClientChatMessage {
  return {
    ...baseMessage,
    clientRequestId: overrides.id,
    ...overrides,
  };
}

describe("chat-state", () => {
  it("merges realtime messages by id or client request id and preserves ordering", () => {
    const current = [
      message({
        id: "local-2",
        clientRequestId: "request-2",
        senderId: "me",
        body: "optimistic",
        createdAt: "2026-07-06T04:02:00.000Z",
      }),
      message({
        id: "message-1",
        clientRequestId: "request-1",
        senderId: "them",
        body: "first",
        createdAt: "2026-07-06T04:01:00.000Z",
      }),
    ];

    const merged = mergeChatMessage(
      current,
      message({
        id: "message-2",
        clientRequestId: "request-2",
        senderId: "me",
        body: "server copy",
        createdAt: "2026-07-06T04:02:00.000Z",
      })
    );

    expect(merged.map((item) => item.id)).toEqual(["message-1", "message-2"]);
    expect(merged[1].body).toBe("server copy");
  });

  it("keeps the known sender display name when a command ack omits it", () => {
    const current = [
      message({
        id: "message-1",
        senderId: "them",
        body: "hahahaha",
        senderDisplayName: "Coach Jordan",
      }),
    ];

    // Reaction/delete acks return the bare message row: no display name.
    const merged = mergeChatMessage(
      current,
      message({
        id: "message-1",
        senderId: "them",
        body: "hahahaha",
        senderDisplayName: null,
        reactions: [{ emoji: "👍", count: 2, byMe: true }],
      })
    );

    expect(merged[0].senderDisplayName).toBe("Coach Jordan");
    expect(merged[0].reactions).toEqual([{ emoji: "👍", count: 2, byMe: true }]);
  });

  it("derives sent, delivered, and read states from the participant read row", () => {
    const messages = [
      message({ id: "m1", senderId: "me", body: "one" }),
      message({ id: "m2", senderId: "me", body: "two" }),
      message({ id: "m3", senderId: "them", body: "reply" }),
    ];
    const readState: ClientChatReadState = {
      userId: "them",
      lastDeliveredMessageId: "m1",
      deliveredAt: "2026-07-06T04:03:00.000Z",
      lastReadMessageId: null,
      readAt: null,
    };

    expect(getOutgoingMessageStatus(messages[0], messages, readState)).toBe(
      "delivered"
    );
    expect(getOutgoingMessageStatus(messages[1], messages, readState)).toBe("sent");

    expect(
      getOutgoingMessageStatus(messages[1], messages, {
        ...readState,
        lastDeliveredMessageId: "m2",
        lastReadMessageId: "m2",
        readAt: "2026-07-06T04:04:00.000Z",
      })
    ).toBe("read");
  });

  it("counts unread participant messages after the current user's read marker", () => {
    const messages = [
      message({ id: "m1", senderId: "them", body: "read already" }),
      message({ id: "m2", senderId: "them", body: "new one" }),
      message({ id: "m3", senderId: "me", body: "mine" }),
      message({ id: "m4", senderId: "them", body: "new two" }),
    ];

    expect(
      countUnreadMessages(messages, "me", {
        userId: "me",
        lastDeliveredMessageId: "m4",
        deliveredAt: "2026-07-06T04:03:00.000Z",
        lastReadMessageId: "m1",
        readAt: "2026-07-06T04:01:00.000Z",
      })
    ).toBe(2);
  });

  it("summarizes unread boundaries and excludes own or deleted messages", () => {
    const messages = [
      message({
        id: "m1",
        senderId: "them",
        body: "read already",
        createdAt: "2026-07-06T04:01:00.000Z",
      }),
      message({
        id: "m2",
        senderId: "them",
        body: "first unread",
        createdAt: "2026-07-06T04:02:00.000Z",
      }),
      message({
        id: "m3",
        senderId: "me",
        body: "mine",
        createdAt: "2026-07-06T04:03:00.000Z",
      }),
      message({
        id: "m4",
        senderId: "them",
        body: "deleted",
        deletedAt: "2026-07-06T04:05:00.000Z",
        createdAt: "2026-07-06T04:04:00.000Z",
      }),
      message({
        id: "m5",
        senderId: "them",
        body: "latest unread",
        createdAt: "2026-07-06T04:05:00.000Z",
      }),
    ];

    expect(
      getUnreadMessageSummary(messages, "me", {
        userId: "me",
        lastDeliveredMessageId: "m5",
        deliveredAt: "2026-07-06T04:06:00.000Z",
        lastReadMessageId: "m1",
        readAt: "2026-07-06T04:01:30.000Z",
      })
    ).toEqual({
      count: 2,
      oldestUnreadAt: "2026-07-06T04:02:00.000Z",
      latestUnreadMessageId: "m5",
    });
  });

  it("builds reply previews and hides deleted message text", () => {
    const messages = [
      message({
        id: "m1",
        senderId: "them",
        senderRole: "coach",
        body: "Please repeat the final sentence.",
      }),
      message({
        id: "m2",
        senderId: "them",
        senderRole: "coach",
        body: "",
        deletedAt: "2026-07-06T04:10:00.000Z",
      }),
    ];

    expect(toReplyPreview(messages[0], "me", "Coach Dana", "Alex")).toEqual({
      id: "m1",
      authorName: "Coach Dana",
      snippet: "Please repeat the final sentence.",
    });
    expect(toReplyPreview(messages[1], "me", "Coach Dana", "Alex")).toEqual({
      id: "m2",
      authorName: "Coach Dana",
      snippet: "Message deleted",
    });
  });

  it("merges private image metadata into a realtime placeholder", () => {
    const current = [message({ id: "m-image", senderId: "them", body: "" })];
    const images = [{
      id: "image-1",
      status: "ready" as const,
      originalName: "photo.png",
      width: 1200,
      height: 800,
      thumbnailPath: "chat/image/thumbnail.webp",
      displayPath: "chat/image/display.webp",
      thumbnailUrl: "https://storage.test/thumbnail",
      displayUrl: "https://storage.test/display",
    }];

    const merged = mergeChatMessage(
      current,
      message({ id: "m-image", senderId: "them", body: "", images })
    );

    expect(merged[0].images).toEqual(images);
    expect(toReplyPreview(merged[0], "me", "Coach Dana", "Alex").snippet).toBe("Image");
  });
});
