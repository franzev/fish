import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signOutMock, pushMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => ({ ok: true, data: undefined })),
  pushMock: vi.fn(),
}));

vi.mock("@/lib/auth/browser", () => ({
  signOut: signOutMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import {
  chatStore,
  resetChatStoreForTests,
} from "@/app/(authenticated)/chat/store/chat-store";
import {
  selectComposerForConversation,
  selectMessagesForConversation,
} from "@/app/(authenticated)/chat/store/chat-selectors";
import { generalChannelId } from "@/lib/channels";
import { LogoutButton } from "./logout-button";

describe("LogoutButton", () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetChatStoreForTests();
  });

  it("clears account A's community draft and pending send so account B starts clean after the same soft logout/login lifecycle (CR-01)", async () => {
    // Simulate account A: an unsent draft plus a pending optimistic send in
    // the one fixed community conversation every account shares.
    chatStore
      .getState()
      .setDraft(generalChannelId, "Account A's unsent draft");
    chatStore.getState().sendOptimisticMessage({
      id: "local-request-logout",
      conversationId: generalChannelId,
      senderId: "account-a",
      senderRole: "client",
      body: "Account A's pending send.",
      clientRequestId: "request-logout",
      createdAt: "2026-07-06T04:07:00.000Z",
    });

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    // Logout still signs out and performs the same soft navigation.
    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));

    // Simulating account B in the same tab (soft nav means no module
    // reload): the shared conversation's composer and messages must be
    // empty, not account A's leftovers.
    expect(
      selectComposerForConversation(chatStore.getState(), generalChannelId)
        .draft
    ).toBe("");
    expect(
      selectMessagesForConversation(chatStore.getState(), generalChannelId)
    ).toEqual([]);
  });
});
