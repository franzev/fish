import { describe, expect, it, vi } from "vitest";
import { hydrateClientChatMessages } from "./chat-message-hydration";

vi.mock("./chat-sender-profiles", () => ({
  loadSenderDisplayNames: vi.fn(async () => new Map()),
}));

const message = {
  id: "message-1",
  conversation_id: "conversation-1",
  sender_id: "client-1",
  sender_role: "client" as const,
  body: "",
  client_request_id: "request-1",
  created_at: "2026-07-18T00:00:00.000Z",
};

describe("hydrateClientChatMessages", () => {
  it("does not turn an attachment query failure into a blank attachment-only message", async () => {
    const attachmentQuery = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("database unavailable"),
      }),
    };
    attachmentQuery.select.mockReturnValue(attachmentQuery);
    attachmentQuery.in.mockReturnValue(attachmentQuery);
    attachmentQuery.eq.mockReturnValue(attachmentQuery);
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "client-1" } } }) },
      from: vi.fn().mockReturnValue(attachmentQuery),
    };

    await expect(hydrateClientChatMessages(client as never, [message])).rejects.toThrow(
      "Message attachments are temporarily unavailable."
    );
  });
});
