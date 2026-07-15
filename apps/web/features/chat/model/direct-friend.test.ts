import { describe, expect, it } from "vitest";
import type { ClientChatData } from "@/lib/services";
import { getDirectFriendProfile } from "./direct-friend";

const chat: ClientChatData = {
  conversationId: "conversation-1",
  kind: "direct",
  currentUserId: "client-1",
  currentUserRole: "client",
  currentUserDisplayName: "Franz",
  participant: {
    id: "friend-1",
    displayName: "Sam",
    role: "client",
    avatarUrl: "https://example.test/sam.png",
  },
  messages: [],
  searchMembers: [
    { id: "friend-1", displayName: "Sam", username: "sam_lee", role: "client" },
  ],
};

describe("getDirectFriendProfile", () => {
  it("returns the friend identity for a client-to-client direct chat", () => {
    expect(getDirectFriendProfile(chat)).toEqual({
      id: "friend-1",
      displayName: "Sam",
      username: "sam_lee",
      avatarUrl: "https://example.test/sam.png",
    });
  });

  it("does not expose friend actions for a coaching conversation", () => {
    expect(
      getDirectFriendProfile({
        ...chat,
        participant: { id: "coach-1", displayName: "Gwyn", role: "coach" },
      })
    ).toBeNull();
  });
});
