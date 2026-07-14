import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const getSessionMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn();
const fetchMock = vi.fn();
const getUnreadSummaryMock = vi.fn();

vi.mock("@/lib/services/env", () => ({
  getPublicEnv: () => ({ supabaseUrl: "http://127.0.0.1:54321" }),
}));

vi.mock("@/lib/services/supabase/server", () => ({
  createServerSupabaseServices: async () => ({
    auth: {
      getCurrentUser: getCurrentUserMock,
      getAccessToken: async () => {
        const result = await getSessionMock();
        if (!result) return { ok: true, data: null };
        return result.error
          ? { ok: false, error: result.error }
          : { ok: true, data: result.data.session?.access_token ?? null };
      },
    },
    database: {
      chat: { getUnreadSummary: getUnreadSummaryMock },
    },
  }),
  createServerSupabaseClient: async () => ({
    auth: {
      getSession: getSessionMock,
      getUser: async () => {
        const result = await getCurrentUserMock();
        return { data: { user: result.ok ? result.data : null }, error: result.ok ? null : result.error };
      },
    },
    rpc: rpcMock,
    from: fromMock,
  }),
}));

vi.stubGlobal("fetch", fetchMock);

import {
  backfillMessagesAction,
  deleteMessageAction,
  editMessageAction,
  loadNewestMessagesAction,
  loadOlderMessagesAction,
  markReadStateAction,
  refreshConversationAction,
  refreshMessagesAction,
  refreshUnreadSummaryAction,
  sendMessageAction,
  toggleReactionAction,
} from "./actions";

const validInput = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  body: "  Hello coach  ",
  clientRequestId: "request-1",
};

function mockSignedIn() {
  getCurrentUserMock.mockResolvedValue({
    ok: true,
    data: { id: "client-1" },
  });
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: "token-1" } },
    error: null,
  });
}

function messageRow(overrides: Partial<{
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "client" | "coach";
  body: string;
  client_request_id: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_message_id: string | null;
  reactions: Array<{ emoji: string; count: number; by_me?: boolean }>;
}> = {}) {
  return {
    id: "message-1",
    conversation_id: validInput.conversationId,
    sender_id: "client-1",
    sender_role: "client" as const,
    body: "Hello coach",
    client_request_id: "request-1",
    created_at: "2026-07-05T00:00:00.000Z",
    edited_at: null,
    deleted_at: null,
    reply_to_message_id: null,
    reactions: [],
    ...overrides,
  };
}

// Chainable Supabase query-builder stub for the new pagination/backfill/reset
// actions — these skip the Edge-Function-first branch and query fromMock
// directly, so `.or(...)` (the composite keyset filter) must be supported
// alongside select/eq/in/order/limit.
function createChainStub(value: unknown) {
  const result = { data: value, error: null };
  const builder: Record<string, unknown> = {
    maybeSingle: vi.fn(async () => ({
      data: Array.isArray(value) ? value[0] ?? null : value,
      error: null,
    })),
    then: (
      resolve: (outcome: typeof result) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "eq", "in", "is", "order", "limit", "range", "or"]) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

function stubChatTables(tables: Record<string, unknown>) {
  fromMock.mockImplementation((table: string) => createChainStub(tables[table] ?? []));
  rpcMock.mockImplementation(async (name: string) => ({
    data: name === "list_conversation_member_profiles"
      ? ((tables.profiles as Array<{ id: string; display_name: string }> | undefined) ?? [])
          .map((profile) => ({
            conversation_id: validInput.conversationId,
            ...profile,
            username: profile.id,
          }))
      : null,
    error: null,
  }));
}

function paginationMessageRow(position: number) {
  const minute = String(position).padStart(2, "0");
  return messageRow({
    id: `message-${String(position).padStart(3, "0")}`,
    created_at: `2026-07-05T00:${minute}:00.000Z`,
  });
}

describe("sendMessageAction", () => {
  afterEach(() => {
    vi.useRealTimers();
    getCurrentUserMock.mockReset();
    getSessionMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    fetchMock.mockReset();
    getUnreadSummaryMock.mockReset();
  });

  it("returns a calm notice when signed out", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ ok: true, data: null });
    getSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const result = await sendMessageAction(validInput);

    expect(result.status).toBe("notice");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects blank and oversized messages before fetch", async () => {
    mockSignedIn();

    const blank = await sendMessageAction({
      ...validInput,
      body: "   ",
    });

    expect(blank.status).toBe("notice");
    expect(blank.notice).toBe("Add a message before sending.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through the Edge Function with the bearer token", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: messageRow(),
      }),
    });

    const result = await sendMessageAction(validInput);

    expect(result.status).toBe("sent");
    expect(result.message?.body).toBe("Hello coach");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/send-message",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
        body: JSON.stringify({
          conversationId: validInput.conversationId,
          body: "Hello coach",
          clientRequestId: "request-1",
        }),
      })
    );
  });

  it("falls back to authenticated RPC when the local Edge runtime is unavailable", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ message: "name resolution failed" }),
    });
    rpcMock.mockResolvedValueOnce({
      data: messageRow({ body: "Hello coach" }),
      error: null,
    });

    const result = await sendMessageAction(validInput);

    expect(result.status).toBe("sent");
    expect(result.message?.body).toBe("Hello coach");
    expect(rpcMock).toHaveBeenCalledWith("send_chat_message", {
      p_conversation_id: validInput.conversationId,
      p_body: "Hello coach",
      p_client_request_id: "request-1",
    });
  });

  it("falls back to authenticated RPC when the local Edge request hangs", async () => {
    vi.useFakeTimers();
    mockSignedIn();
    fetchMock.mockImplementationOnce(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );
    rpcMock.mockResolvedValueOnce({
      data: messageRow({ body: "Hello coach" }),
      error: null,
    });

    const resultPromise = sendMessageAction(validInput);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await Promise.race([
      resultPromise,
      Promise.resolve({ status: "still-pending" as const }),
    ]);

    expect(result.status).toBe("sent");
    expect(rpcMock).toHaveBeenCalledWith("send_chat_message", {
      p_conversation_id: validInput.conversationId,
      p_body: "Hello coach",
      p_client_request_id: "request-1",
    });
  });

  it("passes reply targets through the send Edge Function", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          id: "message-2",
          conversation_id: validInput.conversationId,
          sender_id: "client-1",
          sender_role: "client",
          body: "Reply body",
          client_request_id: "request-2",
          created_at: "2026-07-05T00:01:00.000Z",
          edited_at: null,
          deleted_at: null,
          reply_to_message_id: "message-1",
          reactions: [],
        },
      }),
    });

    const result = await sendMessageAction({
      ...validInput,
      body: "Reply body",
      clientRequestId: "request-2",
      replyToMessageId: "message-1",
    });

    expect(result.status).toBe("sent");
    expect(result.message?.replyToMessageId).toBe("message-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/send-message",
      expect.objectContaining({
        body: JSON.stringify({
          conversationId: validInput.conversationId,
          body: "Reply body",
          clientRequestId: "request-2",
          replyToMessageId: "message-1",
        }),
      })
    );
  });

  it("returns the Edge Function notice on failed send", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "That conversation is not available." }),
    });

    const result = await sendMessageAction(validInput);

    expect(result.status).toBe("notice");
    expect(result.notice).toBe("That conversation is not available.");
  });

  it("surfaces sign-in guidance when the Edge Function rejects a stale session", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Your session ended. Sign in again to send." }),
    });

    const result = await sendMessageAction(validInput);

    expect(result).toMatchObject({
      status: "notice",
      notice: "Your session ended. Sign in again to send.",
    });
  });

  it("returns a notice instead of throwing when the send request rejects", async () => {
    mockSignedIn();
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "database unavailable" },
    });

    const result = await sendMessageAction(validInput);

    expect(result.status).toBe("notice");
    expect(result.notice).toBe("That did not send yet. Keep this open and try again.");
  });
});

describe("chat command actions", () => {
  afterEach(() => {
    vi.useRealTimers();
    getCurrentUserMock.mockReset();
    getSessionMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    fetchMock.mockReset();
    getUnreadSummaryMock.mockReset();
  });

  it("edits a message through the chat command Edge Function", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          id: "message-1",
          conversation_id: validInput.conversationId,
          sender_id: "client-1",
          sender_role: "client",
          body: "Edited",
          client_request_id: "request-1",
          created_at: "2026-07-05T00:00:00.000Z",
          edited_at: "2026-07-05T00:02:00.000Z",
          deleted_at: null,
          reply_to_message_id: null,
          reactions: [],
        },
      }),
    });

    const result = await editMessageAction({
      messageId: "message-1",
      body: "  Edited  ",
    });

    expect(result.status).toBe("sent");
    expect(result.message?.editedAt).toBe("2026-07-05T00:02:00.000Z");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/chat-command",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
        body: JSON.stringify({
          action: "edit-message",
          messageId: "message-1",
          body: "Edited",
        }),
      })
    );
  });

  it("deletes a message through the chat command Edge Function", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          id: "message-1",
          conversation_id: validInput.conversationId,
          sender_id: "client-1",
          sender_role: "client",
          body: "",
          client_request_id: "request-1",
          created_at: "2026-07-05T00:00:00.000Z",
          edited_at: null,
          deleted_at: "2026-07-05T00:03:00.000Z",
          reply_to_message_id: null,
          reactions: [],
        },
      }),
    });

    const result = await deleteMessageAction({ messageId: "message-1" });

    expect(result.status).toBe("sent");
    expect(result.message?.deletedAt).toBe("2026-07-05T00:03:00.000Z");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/chat-command",
      expect.objectContaining({
        body: JSON.stringify({
          action: "delete-message",
          messageId: "message-1",
        }),
      })
    );
  });

  it("toggles reactions through the chat command Edge Function", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          id: "message-1",
          conversation_id: validInput.conversationId,
          sender_id: "coach-1",
          sender_role: "coach",
          body: "How did practice feel today?",
          client_request_id: "request-1",
          created_at: "2026-07-05T00:00:00.000Z",
          edited_at: null,
          deleted_at: null,
          reply_to_message_id: null,
          reactions: [{ emoji: "👍", count: 1, by_me: true }],
        },
      }),
    });

    const result = await toggleReactionAction({
      messageId: "message-1",
      emoji: "👍",
    });

    expect(result.status).toBe("sent");
    expect(result.message?.reactions).toEqual([
      { emoji: "👍", count: 1, byMe: true },
    ]);
  });

  it("marks delivered and read state through the chat command Edge Function", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readState: {
          user_id: "client-1",
          last_delivered_message_id: "message-1",
          delivered_at: "2026-07-05T00:00:02.000Z",
          last_read_message_id: "message-1",
          read_at: "2026-07-05T00:00:03.000Z",
        },
      }),
    });

    const result = await markReadStateAction({
      conversationId: validInput.conversationId,
      lastDeliveredMessageId: "message-1",
      lastReadMessageId: "message-1",
    });

    expect(result.status).toBe("sent");
    expect(result.readState).toEqual({
      userId: "client-1",
      lastDeliveredMessageId: "message-1",
      deliveredAt: "2026-07-05T00:00:02.000Z",
      lastReadMessageId: "message-1",
      readAt: "2026-07-05T00:00:03.000Z",
    });
  });

  it("refreshes exact unread summary metadata through the chat repository", async () => {
    getUnreadSummaryMock.mockResolvedValue({
      ok: true,
      data: {
        count: 11,
        oldestUnreadAt: "2026-07-14T07:25:00.000Z",
        latestUnreadMessageId: "message-11",
      },
    });

    await expect(
      refreshUnreadSummaryAction({ conversationId: validInput.conversationId })
    ).resolves.toEqual({
      status: "sent",
      values: { conversationId: validInput.conversationId },
      unreadSummary: {
        count: 11,
        oldestUnreadAt: "2026-07-14T07:25:00.000Z",
        latestUnreadMessageId: "message-11",
      },
    });
    expect(getUnreadSummaryMock).toHaveBeenCalledWith(validInput.conversationId);
  });

  it("refreshes messages with reactions through the chat command Edge Function", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [
          {
            id: "message-1",
            conversation_id: validInput.conversationId,
            sender_id: "coach-1",
            sender_role: "coach",
            body: "How did practice feel today?",
            client_request_id: "request-1",
            created_at: "2026-07-05T00:00:00.000Z",
            edited_at: null,
            deleted_at: null,
            reply_to_message_id: null,
            reactions: [{ emoji: "👍", count: 2, by_me: true }],
          },
        ],
      }),
    });

    const result = await refreshMessagesAction({
      messageIds: ["message-1", "message-1"],
    });

    expect(result.status).toBe("sent");
    expect(result.messages?.[0]?.reactions).toEqual([
      { emoji: "👍", count: 2, byMe: true },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/chat-command",
      expect.objectContaining({
        body: JSON.stringify({
          action: "refresh-messages",
          messageIds: ["message-1"],
        }),
      })
    );
  });

  it("refreshes a full conversation snapshot through the chat command Edge Function", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [
          {
            id: "message-1",
            conversation_id: validInput.conversationId,
            sender_id: "coach-1",
            sender_role: "coach",
            body: "Missed while offline.",
            client_request_id: "request-1",
            created_at: "2026-07-05T00:00:00.000Z",
            edited_at: null,
            deleted_at: null,
            reply_to_message_id: null,
            reactions: [],
          },
        ],
        readStates: [
          {
            user_id: "coach-1",
            last_delivered_message_id: "message-1",
            delivered_at: "2026-07-05T00:00:02.000Z",
            last_read_message_id: null,
            read_at: null,
          },
        ],
      }),
    });

    const result = await refreshConversationAction({
      conversationId: validInput.conversationId,
    });

    expect(result.status).toBe("sent");
    expect(result.messages?.[0]?.body).toBe("Missed while offline.");
    expect(result.readStates?.[0]?.readAt).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/chat-command",
      expect.objectContaining({
        body: JSON.stringify({
          action: "refresh-conversation",
          conversationId: validInput.conversationId,
        }),
      })
    );
  });
});

describe("pagination, backfill, and reset-window actions", () => {
  afterEach(() => {
    vi.useRealTimers();
    getCurrentUserMock.mockReset();
    getSessionMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    fetchMock.mockReset();
    getUnreadSummaryMock.mockReset();
  });

  it("returns a bounded older page ascending with hasMoreOlder true past the boundary", async () => {
    mockSignedIn();
    // Seeded newest-first (DESC), matching what the keyset query returns
    // before app code reverses it back to ascending.
    const rows = Array.from({ length: 41 }, (_, index) =>
      paginationMessageRow(40 - index)
    );
    stubChatTables({
      messages: rows,
      message_reactions: [],
      profiles: [{ id: "client-1", display_name: "Franz Fish" }],
    });

    const result = await loadOlderMessagesAction({
      conversationId: validInput.conversationId,
      cursor: null,
    });

    expect(result.status).toBe("sent");
    expect(result.messages).toHaveLength(40);
    expect(result.hasMoreOlder).toBe(true);
    expect(result.messages?.[0]?.id).toBe("message-001");
    expect(result.messages?.[39]?.id).toBe("message-040");
    expect(result.messages?.[0]?.senderDisplayName).toBe("Franz Fish");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns hasMoreOlder false when the older page is at or under the boundary", async () => {
    mockSignedIn();
    const rows = [2, 1, 0].map((position) => paginationMessageRow(position));
    stubChatTables({
      messages: rows,
      message_reactions: [],
      profiles: [{ id: "client-1", display_name: "Franz Fish" }],
    });

    const result = await loadOlderMessagesAction({
      conversationId: validInput.conversationId,
      cursor: {
        createdAt: "2026-07-05T00:05:00.000Z",
        id: "22222222-2222-4222-8222-222222222222",
      },
    });

    expect(result.status).toBe("sent");
    expect(result.hasMoreOlder).toBe(false);
    expect(result.messages?.map((message) => message.id)).toEqual([
      "message-000",
      "message-001",
      "message-002",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a Postgres offset-format cursor (created_at with +00:00, not Z)", async () => {
    // Regression: supabase-js/PostgREST serialise timestamptz as
    // "2026-07-05T00:05:00.000000+00:00", never with a "Z" suffix. Zod 4's
    // z.iso.datetime() rejects offsets by default, which silently failed the
    // keyset cursor live and surfaced "Couldn't load earlier messages."
    mockSignedIn();
    const rows = [2, 1, 0].map((position) => paginationMessageRow(position));
    stubChatTables({
      messages: rows,
      message_reactions: [],
      profiles: [{ id: "client-1", display_name: "Franz Fish" }],
    });

    const result = await loadOlderMessagesAction({
      conversationId: validInput.conversationId,
      cursor: {
        createdAt: "2026-07-05T00:05:00.000000+00:00",
        id: "22222222-2222-4222-8222-222222222222",
      },
    });

    expect(result.status).toBe("sent");
    expect(fromMock).toHaveBeenCalled();
  });

  it("accepts a Postgres offset-format afterCreatedAt during backfill", async () => {
    mockSignedIn();
    const rows = [0, 1, 2].map((position) => paginationMessageRow(position));
    stubChatTables({
      messages: rows,
      message_reactions: [],
      profiles: [{ id: "client-1", display_name: "Franz Fish" }],
    });

    const result = await backfillMessagesAction({
      conversationId: validInput.conversationId,
      afterCreatedAt: "2026-07-04T23:59:00.000000+00:00",
      afterMessageId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.status).toBe("sent");
    expect(fromMock).toHaveBeenCalled();
  });

  it("sets needsReset true when more than the bound of newer messages exist during backfill", async () => {
    mockSignedIn();
    const rows = Array.from({ length: 41 }, (_, index) => paginationMessageRow(index));
    stubChatTables({
      messages: rows,
      message_reactions: [],
      profiles: [{ id: "client-1", display_name: "Franz Fish" }],
    });

    const result = await backfillMessagesAction({
      conversationId: validInput.conversationId,
      afterCreatedAt: "2026-07-04T23:59:00.000Z",
      afterMessageId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.status).toBe("sent");
    expect(result.needsReset).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets needsReset false when newer messages stay at or under the bound", async () => {
    mockSignedIn();
    const rows = [0, 1, 2].map((position) => paginationMessageRow(position));
    stubChatTables({
      messages: rows,
      message_reactions: [],
      profiles: [{ id: "client-1", display_name: "Franz Fish" }],
    });

    const result = await backfillMessagesAction({
      conversationId: validInput.conversationId,
      afterCreatedAt: "2026-07-04T23:59:00.000Z",
      afterMessageId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.status).toBe("sent");
    expect(result.needsReset).toBe(false);
    expect(result.messages).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the bounded newest window with read states for the reconnect reset fallback", async () => {
    mockSignedIn();
    const rows = Array.from({ length: 41 }, (_, index) =>
      paginationMessageRow(40 - index)
    );
    stubChatTables({
      messages: rows,
      message_reactions: [],
      profiles: [{ id: "client-1", display_name: "Franz Fish" }],
      message_reads: [
        {
          user_id: "coach-1",
          last_delivered_message_id: "message-040",
          delivered_at: "2026-07-05T00:41:00.000Z",
          last_read_message_id: null,
          read_at: null,
        },
      ],
    });

    const result = await loadNewestMessagesAction({
      conversationId: validInput.conversationId,
    });

    expect(result.status).toBe("sent");
    expect(result.messages).toHaveLength(40);
    expect(result.hasMoreOlder).toBe(true);
    expect(result.oldestCursor).toEqual({
      createdAt: "2026-07-05T00:01:00.000Z",
      id: "message-001",
    });
    expect(result.readStates?.[0]?.userId).toBe("coach-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed cursor with a calm notice before ever touching the query", async () => {
    mockSignedIn();

    const result = await loadOlderMessagesAction({
      conversationId: validInput.conversationId,
      cursor: { createdAt: "not-a-date", id: "not-a-uuid" },
    });

    expect(result.status).toBe("notice");
    expect(fromMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
