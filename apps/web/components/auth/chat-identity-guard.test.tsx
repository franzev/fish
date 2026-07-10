import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type AuthSession = { user: { id: string } } | null;
type AuthCallback = (event: string, session: AuthSession) => void;

const authMock = vi.hoisted(() => ({
  callback: null as AuthCallback | null,
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/services/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      onAuthStateChange: (callback: AuthCallback) => {
        authMock.callback = callback;
        return {
          data: { subscription: { unsubscribe: authMock.unsubscribe } },
        };
      },
    },
  }),
}));

import {
  chatStore,
  resetChatStoreForTests,
} from "@/app/(authenticated)/chat/store/chat-store";
import { selectComposerForConversation } from "@/app/(authenticated)/chat/store/chat-selectors";
import { generalChannelId } from "@/lib/channels";
import { ChatIdentityGuard } from "./chat-identity-guard";

describe("ChatIdentityGuard", () => {
  afterEach(() => {
    // Explicit + ordered: unmount whatever this test rendered (running the
    // guard's cleanup, which calls unsubscribe) BEFORE clearing mock call
    // counts, so a leftover unmount-triggered call never leaks into the
    // next test's "was it called exactly once" assertion.
    cleanup();
    vi.clearAllMocks();
    authMock.callback = null;
    resetChatStoreForTests();
  });

  it("purges a seeded draft when the userId prop changes to a different account (non-button transition)", () => {
    const { rerender } = render(<ChatIdentityGuard userId="account-a" />);
    chatStore.getState().setDraft(generalChannelId, "Account A's draft");

    rerender(<ChatIdentityGuard userId="account-b" />);

    expect(
      selectComposerForConversation(chatStore.getState(), generalChannelId)
        .draft
    ).toBe("");
  });

  it("clears the store on a captured SIGNED_OUT auth event", () => {
    render(<ChatIdentityGuard userId="account-a" />);
    chatStore.getState().setDraft(generalChannelId, "Account A's draft");

    act(() => {
      authMock.callback?.("SIGNED_OUT", null);
    });

    expect(
      selectComposerForConversation(chatStore.getState(), generalChannelId)
        .draft
    ).toBe("");
  });

  it("purges on a cross-identity auth event but preserves state for a same-user TOKEN_REFRESHED", () => {
    render(<ChatIdentityGuard userId="account-a" />);
    chatStore.getState().setDraft(generalChannelId, "Account A's draft");

    act(() => {
      authMock.callback?.("TOKEN_REFRESHED", { user: { id: "account-a" } });
    });
    expect(
      selectComposerForConversation(chatStore.getState(), generalChannelId)
        .draft
    ).toBe("Account A's draft");

    act(() => {
      authMock.callback?.("SIGNED_IN", { user: { id: "account-b" } });
    });
    expect(
      selectComposerForConversation(chatStore.getState(), generalChannelId)
        .draft
    ).toBe("");
  });

  it("renders nothing and unsubscribes the auth listener on unmount", () => {
    const { container, unmount } = render(
      <ChatIdentityGuard userId="account-a" />
    );
    expect(container).toBeEmptyDOMElement();

    unmount();

    expect(authMock.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
