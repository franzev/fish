import { describe, expect, it, vi } from "vitest";
import type { ChatCommandService } from "@/lib/services";
import { createChatActionHandlers } from "./action-handlers";

function chatFake(
  overrides: Partial<ChatCommandService> = {}
): ChatCommandService {
  const unexpected = async () => {
    throw new Error("Unexpected chat operation");
  };
  return {
    sendMessage: unexpected,
    executeMessageCommand: unexpected,
    reportGif: unexpected,
    markReadState: unexpected,
    refreshMessages: unexpected,
    refreshConversation: unexpected,
    loadOlderMessages: unexpected,
    backfillMessages: unexpected,
    loadNewestMessages: unexpected,
    ...overrides,
  };
}

describe("createChatActionHandlers", () => {
  const gif = {
    provider: "klipy" as const,
    providerId: "gif-1",
    title: "Facepalm",
    description: "A person facepalming",
    sourceUrl: "https://klipy.com/gifs/gif-1",
    posterUrl: "https://static.klipy.com/gif-1.jpg",
    previewUrl: "https://static1.klipy.com/gif-1-tiny.mp4",
    mediaUrl: "https://static2.klipy.com/gif-1.mp4",
    width: 480,
    height: 270,
  };
  it("validates before crossing the chat command seam", async () => {
    const sendMessage = vi.fn();
    const handlers = createChatActionHandlers(chatFake({ sendMessage }));

    const result = await handlers.sendMessage({ body: "   " });

    expect(result.status).toBe("notice");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("delegates normalized input without exposing transport details", async () => {
    const message = {
      id: "message-1",
      conversationId: "11111111-1111-4111-8111-111111111111",
      senderId: "client-1",
      senderRole: "client" as const,
      body: "Hello coach",
      clientRequestId: "request-1",
      createdAt: "2026-07-11T00:00:00.000Z",
    };
    const sendMessage = vi.fn(async () => ({ ok: true as const, data: message }));
    const handlers = createChatActionHandlers(chatFake({ sendMessage }));

    const result = await handlers.sendMessage({
      conversationId: message.conversationId,
      body: "  Hello coach  ",
      clientRequestId: message.clientRequestId,
    });

    expect(sendMessage).toHaveBeenCalledWith({
      conversationId: message.conversationId,
      body: "Hello coach",
      clientRequestId: message.clientRequestId,
    });
    expect(result).toMatchObject({ status: "sent", message });
  });

  it("accepts an image-only message and preserves attachment ids", async () => {
    const attachmentId = "22222222-2222-4222-8222-222222222222";
    const sent = {
      id: "message-image-1",
      conversationId: "11111111-1111-4111-8111-111111111111",
      senderId: "client-1",
      senderRole: "client" as const,
      body: "",
      clientRequestId: "image-request-1",
      createdAt: "2026-07-11T00:00:00.000Z",
    };
    const sendMessage = vi.fn(async () => ({ ok: true as const, data: sent }));
    const handlers = createChatActionHandlers(chatFake({ sendMessage }));

    const result = await handlers.sendMessage({
      conversationId: sent.conversationId,
      body: "",
      clientRequestId: sent.clientRequestId,
      attachmentIds: [attachmentId],
    });

    expect(result.status).toBe("sent");
    expect(sendMessage).toHaveBeenCalledWith({
      conversationId: sent.conversationId,
      body: "",
      clientRequestId: sent.clientRequestId,
      attachmentIds: [attachmentId],
    });
  });

  it("accepts a sticker-only message and preserves its bundled catalog id", async () => {
    const sent = {
      id: "message-sticker-1",
      conversationId: "11111111-1111-4111-8111-111111111111",
      senderId: "client-1",
      senderRole: "client" as const,
      body: "",
      stickerId: "aquatic-hello-otter" as const,
      clientRequestId: "sticker-request-1",
      createdAt: "2026-07-13T00:00:00.000Z",
    };
    const sendMessage = vi.fn(async () => ({ ok: true as const, data: sent }));
    const handlers = createChatActionHandlers(chatFake({ sendMessage }));

    const result = await handlers.sendMessage({
      conversationId: sent.conversationId,
      body: "",
      clientRequestId: sent.clientRequestId,
      stickerId: sent.stickerId,
    });

    expect(result.status).toBe("sent");
    expect(sendMessage).toHaveBeenCalledWith({
      conversationId: sent.conversationId,
      body: "",
      clientRequestId: sent.clientRequestId,
      stickerId: sent.stickerId,
    });
  });

  it("accepts a GIF-only message and rejects spoofed provider media", async () => {
    const sent = {
      id: "message-gif-1",
      conversationId: "11111111-1111-4111-8111-111111111111",
      senderId: "client-1",
      senderRole: "client" as const,
      body: "",
      gif,
      clientRequestId: "gif-request-1",
      createdAt: "2026-07-11T00:00:00.000Z",
    };
    const sendMessage = vi.fn(async () => ({ ok: true as const, data: sent }));
    const handlers = createChatActionHandlers(chatFake({ sendMessage }));

    expect((await handlers.sendMessage({
      conversationId: sent.conversationId,
      body: "",
      clientRequestId: sent.clientRequestId,
      gif,
    })).status).toBe("sent");
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ gif }));

    sendMessage.mockClear();
    const rejected = await handlers.sendMessage({
      conversationId: sent.conversationId,
      body: "",
      clientRequestId: "spoofed",
      gif: { ...gif, mediaUrl: "https://example.com/tracker.mp4" },
    });
    expect(rejected).toMatchObject({
      status: "notice",
      notice: "That GIF is not available. Choose another one.",
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("reports a GIF through the sensitive command boundary", async () => {
    const reportGif = vi.fn(async () => ({ ok: true as const, data: undefined }));
    const handlers = createChatActionHandlers(chatFake({ reportGif }));
    const messageId = "22222222-2222-4222-8222-222222222222";

    const result = await handlers.reportGif({ messageId });

    expect(result).toEqual({ status: "sent", values: { messageId } });
    expect(reportGif).toHaveBeenCalledWith({ messageId });
  });
});
