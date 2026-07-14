import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDirectConversationPreviewsMock } = vi.hoisted(() => ({
  getDirectConversationPreviewsMock: vi.fn(),
}));

vi.mock("./page-data", () => ({
  getDirectConversationPreviews: getDirectConversationPreviewsMock,
}));

import { loadMessagePopoverAction } from "./actions";

describe("loadMessagePopoverAction", () => {
  beforeEach(() => {
    getDirectConversationPreviewsMock.mockReset();
  });

  it("returns all compact direct-conversation previews", async () => {
    getDirectConversationPreviewsMock.mockResolvedValue([
      {
        conversationId: "11111111-1111-4111-8111-111111111111",
        participant: {
          id: "coach-1",
          displayName: "Gwyn",
          role: "coach",
          avatarUrl: "https://example.com/avatar.webp",
        },
        latestMessage: {
          senderId: "coach-1",
          text: "How did practice feel today?",
          createdAt: "2026-07-14T08:33:00.000Z",
        },
        unreadCount: 1,
      },
    ]);

    await expect(loadMessagePopoverAction({})).resolves.toEqual({
      status: "sent",
      values: {},
      previews: [{
        conversationId: "11111111-1111-4111-8111-111111111111",
        participant: {
          id: "coach-1",
          displayName: "Gwyn",
          role: "coach",
          avatarUrl: "https://example.com/avatar.webp",
        },
        latestMessage: {
          senderId: "coach-1",
          text: "How did practice feel today?",
          createdAt: "2026-07-14T08:33:00.000Z",
        },
        unreadCount: 1,
      }],
    });
  });

  it("returns a calm notice when previews cannot be loaded", async () => {
    getDirectConversationPreviewsMock.mockRejectedValue(new Error("offline"));

    await expect(loadMessagePopoverAction({})).resolves.toEqual({
      status: "notice",
      values: {},
      notice: "Messages are still catching up.",
    });
  });
});
