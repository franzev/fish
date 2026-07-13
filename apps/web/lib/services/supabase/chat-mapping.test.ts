import { describe, expect, it } from "vitest";
import { readChatStickerId, toClientChatMessage } from "./chat-mapping";

const row = {
  id: "message-1",
  conversation_id: "conversation-1",
  sender_id: "client-1",
  sender_role: "client" as const,
  body: "",
  client_request_id: "request-1",
  created_at: "2026-07-14T00:00:00.000Z",
};

describe("chat sticker mapping", () => {
  it("ignores empty or non-string persisted values", () => {
    expect(readChatStickerId(null)).toBeUndefined();
    expect(readChatStickerId("   ")).toBeUndefined();
    expect(readChatStickerId(42)).toBeUndefined();
  });

  it("preserves an unknown persisted id for rollout-safe rendering", () => {
    const message = toClientChatMessage({
      ...row,
      sticker_id: " aquatic-future-sticker ",
    });

    expect(message.stickerId).toBe("aquatic-future-sticker");
  });
});
