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
});
