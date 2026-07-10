import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ChatMessageState,
  ChatReadState,
  RealtimeConnectionState,
} from "@fish/core/chat-state";
import {
  chatStore,
  clearChatStore,
  createChatHydrationKey,
  createChatStore,
  resetChatStoreForTests,
  type ChatStoreState,
} from "./chat-store";
import {
  selectComposerForConversation,
  selectConversationState,
  selectHasMoreOlderForConversation,
  selectHydrationKeyForConversation,
  selectIsLoadingOlderForConversation,
  selectMessagesForConversation,
  selectOldestCursorForConversation,
  selectReadStatesForConversation,
  selectRealtimeStatusForConversation,
} from "./chat-selectors";

const conversationId = "conversation-1";

const baseMessage: ChatMessageState = {
  id: "message-1",
  conversationId,
  senderId: "coach-1",
  senderRole: "coach",
  body: "How did practice feel today?",
  clientRequestId: "request-1",
  createdAt: "2026-07-06T04:01:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  reactions: [],
};

const baseReadState: ChatReadState = {
  userId: "client-1",
  lastDeliveredMessageId: "message-1",
  deliveredAt: "2026-07-06T04:02:00.000Z",
  lastReadMessageId: null,
  readAt: null,
};

function getStoreState(): ChatStoreState {
  const store = createChatStore();
  store.getState().hydrateConversation(conversationId, [baseMessage], [baseReadState]);
  return store.getState();
}

describe("chat store authority boundary", () => {
  it("keeps Zustand web-only and reducer-backed", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(authenticated)/chat/store/chat-store.ts"),
      "utf8"
    );

    expect(source).toMatch(/from ["']zustand/);
    expect(source).toContain("@fish/core/chat-state");
    expect(source).toContain("reduceChatState");
    expect(source).toContain("conversationId");
    expect(source).not.toMatch(/@supabase|@\/lib\/services\/supabase|authRedirects|from ["']next|\.\/actions/);
  });

  it("does not expose auth, role, assignment, service-role, or Supabase authority fields", () => {
    const state = getStoreState();
    const forbiddenKeys = [
      "session",
      "auth",
      "currentUser",
      "currentUserId",
      "currentUserRole",
      "rolePermissions",
      "assignment",
      "assignedCoach",
      "supabase",
      "serviceRole",
      "serviceRoleKey",
    ];

    for (const key of forbiddenKeys) {
      expect(state).not.toHaveProperty(key);
    }
  });

  it("keeps pagination as plain client-cache values with no auth/role/assignment/token authority", () => {
    const store = createChatStore();
    store
      .getState()
      .hydrateWindow(conversationId, [baseMessage], [baseReadState], true, {
        createdAt: baseMessage.createdAt,
        id: baseMessage.id,
      });
    store.getState().applyOlderPage(
      conversationId,
      [
        {
          ...baseMessage,
          id: "message-0",
          clientRequestId: "request-0",
          createdAt: "2026-07-06T04:00:00.000Z",
        },
      ],
      false,
      { createdAt: "2026-07-06T04:00:00.000Z", id: "message-0" }
    );

    const state = store.getState();
    const pagination = selectConversationState(state, conversationId)?.pagination;

    expect(pagination).toBeDefined();
    expect(Object.keys(pagination ?? {}).sort()).toEqual(
      ["hasMoreOlder", "isLoadingOlder", "oldestLoadedCursor"].sort()
    );
    expect(selectHasMoreOlderForConversation(state, conversationId)).toBe(false);
    expect(selectIsLoadingOlderForConversation(state, conversationId)).toBe(false);
    expect(selectOldestCursorForConversation(state, conversationId)).toEqual({
      createdAt: "2026-07-06T04:00:00.000Z",
      id: "message-0",
    });

    const forbiddenKeys = [
      "session",
      "auth",
      "currentUser",
      "currentUserId",
      "currentUserRole",
      "rolePermissions",
      "assignment",
      "assignedCoach",
      "supabase",
      "serviceRole",
      "serviceRoleKey",
      "token",
      "accessToken",
    ];

    for (const key of forbiddenKeys) {
      expect(pagination).not.toHaveProperty(key);
    }
  });
});

describe("chat store actions", () => {
  it("hydrates, sends optimistically, confirms, fails, and merges read state by conversation", () => {
    const store = createChatStore();

    store.getState().hydrateConversation(conversationId, [baseMessage], [baseReadState]);
    expect(selectMessagesForConversation(store.getState(), conversationId)).toEqual([
      expect.objectContaining({ id: "message-1", localStatus: "sent" }),
    ]);

    store.getState().sendOptimisticMessage({
      id: "local-request-2",
      conversationId,
      senderId: "client-1",
      senderRole: "client",
      body: "It felt steady.",
      clientRequestId: "request-2",
      createdAt: "2026-07-06T04:03:00.000Z",
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      reactions: [],
    });
    expect(selectMessagesForConversation(store.getState(), conversationId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientRequestId: "request-2",
          localStatus: "sending",
        }),
      ])
    );

    store.getState().confirmSentMessage(
      {
        id: "message-2",
        conversationId,
        senderId: "client-1",
        senderRole: "client",
        body: "It felt steady.",
        clientRequestId: "request-2",
        createdAt: "2026-07-06T04:03:00.000Z",
        editedAt: null,
        deletedAt: null,
        replyToMessageId: null,
        reactions: [],
      },
      "request-2"
    );
    expect(selectMessagesForConversation(store.getState(), conversationId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "message-2", localStatus: "sent" }),
      ])
    );

    store.getState().sendOptimisticMessage({
      id: "local-request-3",
      conversationId,
      senderId: "client-1",
      senderRole: "client",
      body: "Please keep this draft.",
      clientRequestId: "request-3",
      createdAt: "2026-07-06T04:04:00.000Z",
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      reactions: [],
    });
    store.getState().markMessageFailed(conversationId, "request-3", "Not sent yet");

    expect(selectMessagesForConversation(store.getState(), conversationId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "Please keep this draft.",
          clientRequestId: "request-3",
          failureReason: "Not sent yet",
          localStatus: "failed",
        }),
      ])
    );
    expect(selectComposerForConversation(store.getState(), conversationId).draft).toBe(
      "Please keep this draft."
    );

    store.getState().mergeReadState(conversationId, {
      userId: "coach-1",
      lastDeliveredMessageId: "message-2",
      deliveredAt: "2026-07-06T04:05:00.000Z",
      lastReadMessageId: "message-2",
      readAt: "2026-07-06T04:05:30.000Z",
    });
    expect(selectReadStatesForConversation(store.getState(), conversationId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "coach-1",
          lastReadMessageId: "message-2",
        }),
      ])
    );
  });

  it("stores draft, reply/edit targets, realtime status, and clear operations per conversation", () => {
    const store = createChatStore();
    const otherConversationId = "conversation-2";

    store.getState().setDraft(conversationId, "A focused draft");
    store.getState().setReplyTarget(conversationId, "message-1");
    store.getState().setEditTarget(conversationId, "message-2");
    store.getState().setRealtimeStatus(conversationId, "connected");
    store.getState().setDraft(otherConversationId, "Separate draft");

    expect(selectComposerForConversation(store.getState(), conversationId)).toEqual({
      draft: "A focused draft",
      replyTargetId: "message-1",
      editTargetId: "message-2",
    });
    expect(
      selectRealtimeStatusForConversation(store.getState(), conversationId)
    ).toBe("connected" satisfies RealtimeConnectionState);
    expect(selectComposerForConversation(store.getState(), otherConversationId).draft).toBe(
      "Separate draft"
    );

    store.getState().clearConversation(conversationId);
    expect(selectConversationState(store.getState(), conversationId)).toBeNull();
    expect(selectComposerForConversation(store.getState(), otherConversationId).draft).toBe(
      "Separate draft"
    );
  });

  it("tracks which server snapshot hydrated a conversation", () => {
    const store = createChatStore();
    const hydrationKey = createChatHydrationKey([baseMessage], [baseReadState]);

    store
      .getState()
      .hydrateConversation(conversationId, [baseMessage], [baseReadState], hydrationKey);

    expect(selectHydrationKeyForConversation(store.getState(), conversationId)).toBe(
      hydrationKey
    );

    store.getState().sendOptimisticMessage({
      id: "local-request-2",
      conversationId,
      senderId: "client-1",
      senderRole: "client",
      body: "It felt steady.",
      clientRequestId: "request-2",
      createdAt: "2026-07-06T04:03:00.000Z",
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      reactions: [],
    });
    expect(selectHydrationKeyForConversation(store.getState(), conversationId)).toBe(
      hydrationKey
    );

    store.getState().clearConversation(conversationId);
    expect(selectHydrationKeyForConversation(store.getState(), conversationId)).toBeNull();
  });

  it("ignores duplicate realtime payloads without replacing stable store slices", () => {
    const store = createChatStore();
    store.getState().hydrateConversation(conversationId, [baseMessage], [baseReadState]);

    const messagesBefore = selectMessagesForConversation(
      store.getState(),
      conversationId
    );
    const readStatesBefore = selectReadStatesForConversation(
      store.getState(),
      conversationId
    );

    store.getState().mergeRemoteMessage({ ...baseMessage, localStatus: "sent" });
    store.getState().mergeReadState(conversationId, { ...baseReadState });

    expect(selectMessagesForConversation(store.getState(), conversationId)).toBe(
      messagesBefore
    );
    expect(selectReadStatesForConversation(store.getState(), conversationId)).toBe(
      readStatesBefore
    );
  });

  it("pages older history through hydrateWindow/applyOlderPage without duplicating an overlapping page", () => {
    const store = createChatStore();
    const oldestCursor = { createdAt: baseMessage.createdAt, id: baseMessage.id };

    store
      .getState()
      .hydrateWindow(conversationId, [baseMessage], [baseReadState], true, oldestCursor);
    expect(selectHasMoreOlderForConversation(store.getState(), conversationId)).toBe(
      true
    );
    expect(selectOldestCursorForConversation(store.getState(), conversationId)).toEqual(
      oldestCursor
    );

    store.getState().requestOlderMessages(conversationId);
    expect(selectIsLoadingOlderForConversation(store.getState(), conversationId)).toBe(
      true
    );

    const olderMessage: ChatMessageState = {
      ...baseMessage,
      id: "message-0",
      clientRequestId: "request-0",
      body: "Earlier in the conversation.",
      createdAt: "2026-07-06T04:00:00.000Z",
    };
    const newOldestCursor = { createdAt: olderMessage.createdAt, id: olderMessage.id };

    // Overlaps the already-loaded message by id — must merge, not duplicate.
    store
      .getState()
      .applyOlderPage(conversationId, [olderMessage, baseMessage], false, newOldestCursor);

    expect(selectMessagesForConversation(store.getState(), conversationId)).toHaveLength(
      2
    );
    expect(selectHasMoreOlderForConversation(store.getState(), conversationId)).toBe(
      false
    );
    expect(selectIsLoadingOlderForConversation(store.getState(), conversationId)).toBe(
      false
    );
    expect(selectOldestCursorForConversation(store.getState(), conversationId)).toEqual(
      newOldestCursor
    );
  });

  it("leaves pagination retryable when an older page fails to load", () => {
    const store = createChatStore();
    store
      .getState()
      .hydrateWindow(conversationId, [baseMessage], [baseReadState], true, {
        createdAt: baseMessage.createdAt,
        id: baseMessage.id,
      });

    store.getState().requestOlderMessages(conversationId);
    store.getState().markOlderPageFailed(conversationId);

    expect(selectIsLoadingOlderForConversation(store.getState(), conversationId)).toBe(
      false
    );
    // hasMoreOlder/cursor stay untouched so a retry is still possible.
    expect(selectHasMoreOlderForConversation(store.getState(), conversationId)).toBe(
      true
    );
  });
});

describe("clearChatStore", () => {
  // Operates on the real singleton (not createChatStore()), so a leftover
  // seed here must never bleed into other describe blocks in this file.
  afterEach(() => {
    resetChatStoreForTests();
  });

  it("empties conversations and hydration keys after a draft, a pending send, and a hydration key are seeded", () => {
    const hydrationKey = createChatHydrationKey([baseMessage], [baseReadState]);
    chatStore
      .getState()
      .hydrateConversation(conversationId, [baseMessage], [baseReadState], hydrationKey);
    chatStore.getState().setDraft(conversationId, "Account A's unsent draft");
    chatStore.getState().sendOptimisticMessage({
      id: "local-request-clear",
      conversationId,
      senderId: "client-1",
      senderRole: "client",
      body: "Pending before clear.",
      clientRequestId: "request-clear",
      createdAt: "2026-07-06T04:06:00.000Z",
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      reactions: [],
    });

    // Sanity check: the seed actually landed before clearChatStore() runs.
    expect(
      selectMessagesForConversation(chatStore.getState(), conversationId).length
    ).toBeGreaterThan(0);
    expect(
      selectComposerForConversation(chatStore.getState(), conversationId).draft
    ).toBe("Account A's unsent draft");
    expect(
      selectHydrationKeyForConversation(chatStore.getState(), conversationId)
    ).toBe(hydrationKey);

    clearChatStore();

    expect(Object.keys(chatStore.getState().conversations)).toHaveLength(0);
    expect(Object.keys(chatStore.getState().hydrationKeys)).toHaveLength(0);
    expect(
      selectComposerForConversation(chatStore.getState(), conversationId).draft
    ).toBe("");
    expect(
      selectMessagesForConversation(chatStore.getState(), conversationId)
    ).toEqual([]);
    expect(
      selectHydrationKeyForConversation(chatStore.getState(), conversationId)
    ).toBeNull();
  });

  it("clears every conversation in one call, not just the one that was checked", () => {
    const otherConversationId = "conversation-clear-other";
    chatStore.getState().setDraft(conversationId, "Draft in the fixed conversation");
    chatStore.getState().setDraft(otherConversationId, "Draft in another conversation");

    clearChatStore();

    expect(Object.keys(chatStore.getState().conversations)).toHaveLength(0);
    expect(
      selectComposerForConversation(chatStore.getState(), conversationId).draft
    ).toBe("");
    expect(
      selectComposerForConversation(chatStore.getState(), otherConversationId).draft
    ).toBe("");
  });
});

describe("chat store selectors", () => {
  it("return narrow stable slices for one conversation", () => {
    const state = getStoreState();

    expect(selectConversationState(state, conversationId)).toEqual(
      expect.objectContaining({ conversationId })
    );
    expect(selectMessagesForConversation(state, conversationId)).toEqual([
      expect.objectContaining({ id: "message-1" }),
    ]);
    expect(selectReadStatesForConversation(state, conversationId)).toEqual([
      expect.objectContaining({ userId: "client-1" }),
    ]);
    expect(selectComposerForConversation(state, "missing-conversation")).toEqual({
      draft: "",
      replyTargetId: null,
      editTargetId: null,
    });
    expect(selectRealtimeStatusForConversation(state, "missing-conversation")).toBe(
      "idle"
    );
  });

  it("resets the singleton store for test isolation", () => {
    resetChatStoreForTests();
  });
});
