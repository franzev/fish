import { describe, expect, it, vi } from "vitest";

const {
  getCurrentProfileMock,
  getDirectConversationPreviewsMock,
  getServerServicesMock,
  redirectMock,
} = vi.hoisted(() => ({
  getCurrentProfileMock: vi.fn(),
  getDirectConversationPreviewsMock: vi.fn(),
  getServerServicesMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/features/auth/server", () => ({
  getCurrentProfile: getCurrentProfileMock,
}));
vi.mock("@/features/chat/server/page-data", () => ({
  getDirectConversationPreviews: getDirectConversationPreviewsMock,
}));
vi.mock("@/lib/services/runtime/server", () => ({
  getServerServices: getServerServicesMock,
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    redirectMock(href);
    throw new Error("NEXT_REDIRECT");
  },
}));

import MessagesPage from "./page";

describe("MessagesPage", () => {
  it("opens the first server-ranked direct conversation", async () => {
    const services = { auth: {}, database: { profiles: {} } };
    getServerServicesMock.mockResolvedValue(services);
    getCurrentProfileMock.mockResolvedValue({ role: "client", userId: "client-1" });
    getDirectConversationPreviewsMock.mockResolvedValue([{
      conversationId: "conversation-unread",
      participant: { id: "friend-1", displayName: "Sam", role: "client" },
      latestMessage: null,
      unreadCount: 2,
    }]);

    await expect(MessagesPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(getDirectConversationPreviewsMock).toHaveBeenCalledWith(services);
    expect(redirectMock).toHaveBeenCalledWith(
      "/messages/conversation-unread"
    );
  });
});
