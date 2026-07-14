import { beforeEach, describe, expect, it, vi } from "vitest";

const { getChatPageDataMock } = vi.hoisted(() => ({
  getChatPageDataMock: vi.fn(),
}));

vi.mock("./page-data", () => ({
  getChatPageData: getChatPageDataMock,
}));

import { loadMessagePopoverAction } from "./actions";

describe("loadMessagePopoverAction", () => {
  beforeEach(() => {
    getChatPageDataMock.mockReset();
  });

  it("rejects malformed conversation identifiers before reading chat data", async () => {
    await expect(loadMessagePopoverAction({ conversationId: "not-a-uuid" })).resolves.toMatchObject({
      status: "notice",
      notice: "That conversation is not available.",
    });
    expect(getChatPageDataMock).not.toHaveBeenCalled();
  });

  it("returns only the compact direct-conversation preview", async () => {
    getChatPageDataMock.mockResolvedValue({
      role: "client",
      chat: {
        conversationId: "11111111-1111-4111-8111-111111111111",
        kind: "direct",
        currentUserId: "client-1",
        currentUserRole: "client",
        currentUserDisplayName: "Alex Rivera",
        participant: {
          id: "coach-1",
          displayName: "Coach Dana",
          role: "coach",
          avatarUrl: "https://example.com/avatar.webp",
        },
        messages: [
          {
            id: "message-1",
            conversationId: "11111111-1111-4111-8111-111111111111",
            senderId: "coach-1",
            senderRole: "coach",
            body: "How did practice feel today?",
            clientRequestId: "seed-1",
            createdAt: "2026-07-14T08:33:00.000Z",
          },
        ],
      },
    });

    await expect(loadMessagePopoverAction({
      conversationId: "11111111-1111-4111-8111-111111111111",
    })).resolves.toEqual({
      status: "sent",
      values: {
        conversationId: "11111111-1111-4111-8111-111111111111",
      },
      preview: {
        conversationId: "11111111-1111-4111-8111-111111111111",
        participant: {
          id: "coach-1",
          displayName: "Coach Dana",
          avatarUrl: "https://example.com/avatar.webp",
        },
        latestMessage: {
          senderId: "coach-1",
          text: "How did practice feel today?",
          createdAt: "2026-07-14T08:33:00.000Z",
        },
      },
    });
  });
});
