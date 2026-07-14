import { describe, expect, it, vi } from "vitest";
import type { MessageResponseRow } from "./chat-mapping";
import { loadSenderDisplayNames } from "./chat-sender-profiles";
import type { AppSupabaseClient } from "./types";

const message: MessageResponseRow = {
  id: "message-1",
  conversation_id: "conversation-1",
  sender_id: "member-1",
  sender_role: "client",
  body: "Hello",
  client_request_id: "request-1",
  created_at: "2026-07-14T00:00:00.000Z",
};

describe("loadSenderDisplayNames", () => {
  it("loads display-safe sender names in one bulk request", async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        conversation_id: "conversation-1",
        id: "member-1",
        display_name: "Sam",
        username: "sam",
      }],
      error: null,
    }));

    const names = await loadSenderDisplayNames(
      { rpc } as unknown as AppSupabaseClient,
      [message]
    );

    expect(names.get("member-1")).toBe("Sam");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("list_conversation_member_profiles", {
      p_conversation_ids: ["conversation-1"],
    });
  });
});
