import { describe, expect, it } from "vitest";
import { resolveRealtimeSenderName } from "@/features/chat/model/chat-state";

describe("ChatClient realtime boundary", () => {
  it("keeps a known community sender name during a live insert", () => {
    expect(
      resolveRealtimeSenderName(
        { senderId: "member-1", senderDisplayName: null },
        [{ senderId: "member-1", senderDisplayName: "Sam" }],
        { id: "client-1", displayName: "Franz" },
        { id: "coach-1", displayName: "Gwyn" }
      )
    ).toBe("Sam");
  });

  it("uses the participant identity before falling back to an unknown sender", () => {
    expect(
      resolveRealtimeSenderName(
        { senderId: "coach-1", senderDisplayName: null },
        [],
        { id: "client-1", displayName: "Franz" },
        { id: "coach-1", displayName: "Gwyn" }
      )
    ).toBe("Gwyn");
    expect(
      resolveRealtimeSenderName(
        { senderId: "member-2", senderDisplayName: null },
        [],
        { id: "client-1", displayName: "Franz" },
        { id: "coach-1", displayName: "Gwyn" }
      )
    ).toBeNull();
  });
});
