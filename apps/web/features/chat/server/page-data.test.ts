import { ServiceError } from "@/lib/services/errors";
import type { AppServices, ClientChatData } from "@/lib/services";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerServicesMock } = vi.hoisted(() => ({
  getServerServicesMock: vi.fn(),
}));

vi.mock("@/lib/services/runtime/server", () => ({
  getServerServices: getServerServicesMock,
}));

import {
  getCallChatData,
  getDirectConversationPreviews,
} from "./page-data";

const callId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const chat: ClientChatData = {
  conversationId: "conversation-1",
  kind: "direct",
  currentUserId: "client-1",
  currentUserRole: "client",
  currentUserDisplayName: "Alex",
  participant: {
    id: "coach-1",
    displayName: "Coach Dana",
    role: "coach",
  },
  messages: [
    {
      id: "message-1",
      conversationId: "conversation-1",
      senderId: "coach-1",
      senderRole: "coach",
      body: "A call note",
      clientRequestId: "request-1",
      createdAt: "2026-07-14T00:00:00.000Z",
    },
  ],
  searchMembers: [
    {
      id: "coach-1",
      displayName: "Coach Dana",
      username: "coach_dana",
    },
  ],
};

function servicesWith(
  getConversationForCall: ReturnType<typeof vi.fn>,
  resolveUrls = vi.fn().mockResolvedValue([])
) {
  return {
    database: { chat: { getConversationForCall } },
    avatars: { resolveUrls },
  } as unknown as AppServices;
}

describe("getCallChatData", () => {
  beforeEach(() => {
    getServerServicesMock.mockReset();
  });

  it("loads the call conversation and resolves its avatar surfaces", async () => {
    const getConversationForCall = vi.fn().mockResolvedValue({
      ok: true,
      data: chat,
    });
    const resolveUrls = vi.fn().mockResolvedValue([
      { profileId: "coach-1", url: "https://example.test/coach.png" },
    ]);
    getServerServicesMock.mockResolvedValue(
      servicesWith(getConversationForCall, resolveUrls)
    );

    await expect(getCallChatData(callId)).resolves.toMatchObject({
      participant: { avatarUrl: "https://example.test/coach.png" },
      messages: [{ senderAvatarUrl: "https://example.test/coach.png" }],
      searchMembers: [{ avatarUrl: "https://example.test/coach.png" }],
    });
    expect(getConversationForCall).toHaveBeenCalledWith(callId);
    expect(resolveUrls).toHaveBeenCalledWith(["coach-1"], "thumbnail");
  });

  it("returns null without resolving avatars when no conversation exists", async () => {
    const getConversationForCall = vi.fn().mockResolvedValue({
      ok: true,
      data: null,
    });
    const resolveUrls = vi.fn();
    getServerServicesMock.mockResolvedValue(
      servicesWith(getConversationForCall, resolveUrls)
    );

    await expect(getCallChatData(callId)).resolves.toBeNull();
    expect(resolveUrls).not.toHaveBeenCalled();
  });

  it("returns null for a malformed call id without querying services", async () => {
    await expect(getCallChatData("not-a-call-id")).resolves.toBeNull();
    expect(getServerServicesMock).not.toHaveBeenCalled();
  });

  it("preserves service failures for the route error boundary", async () => {
    const error = new ServiceError({
      code: "database",
      message: "Could not load the call conversation.",
    });
    getServerServicesMock.mockResolvedValue(
      servicesWith(
        vi.fn().mockResolvedValue({ ok: false, error })
      )
    );

    await expect(getCallChatData(callId)).rejects.toBe(error);
  });
});

describe("getDirectConversationPreviews", () => {
  it("resolves participant avatars without loading full conversations", async () => {
    const listDirectConversations = vi.fn().mockResolvedValue({
      ok: true,
      data: [{
        conversationId: "conversation-friend",
        participant: {
          id: "friend-1",
          displayName: "Sam Okafor",
          role: "client",
        },
        latestMessage: null,
        unreadCount: 0,
      }],
    });
    const resolveUrls = vi.fn().mockResolvedValue([
      { profileId: "friend-1", url: "https://example.test/friend.png" },
    ]);
    const services = {
      database: { chat: { listDirectConversations } },
      avatars: { resolveUrls },
    } as unknown as AppServices;

    await expect(getDirectConversationPreviews(services)).resolves.toEqual([{
      conversationId: "conversation-friend",
      participant: {
        id: "friend-1",
        displayName: "Sam Okafor",
        role: "client",
        avatarUrl: "https://example.test/friend.png",
      },
      latestMessage: null,
      unreadCount: 0,
    }]);
    expect(listDirectConversations).toHaveBeenCalledTimes(1);
    expect(resolveUrls).toHaveBeenCalledWith(["friend-1"], "thumbnail");
  });
});
