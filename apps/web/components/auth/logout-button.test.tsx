import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServiceResult } from "@/lib/services";

const { signOutMock, pushMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(
    async (): Promise<ServiceResult<void>> => ({ ok: true, data: undefined })
  ),
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
} from "@/features/chat/model/store";
import {
  selectComposerForConversation,
  selectMessagesForConversation,
} from "@/features/chat/model/store";
import { generalChannelId } from "@/lib/channels";
import { ServiceError } from "@/lib/services";
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

  it("preserves account A's chat state and shows a calm retry notice when signOut fails, without navigating (CR-01)", async () => {
    signOutMock.mockResolvedValueOnce({
      ok: false,
      error: new ServiceError({ code: "network", message: "Offline" }),
    });
    chatStore
      .getState()
      .setDraft(generalChannelId, "Account A's unsent draft");

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await screen.findByText(
      "We couldn't sign you out just now. Check your connection and try again."
    );

    expect(pushMock).not.toHaveBeenCalled();
    expect(
      selectComposerForConversation(chatStore.getState(), generalChannelId)
        .draft
    ).toBe("Account A's unsent draft");
  });
});
