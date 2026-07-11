import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseChatSearchRepository } from "./chat-search-repository";

const hydrateClientChatMessages = vi.hoisted(() => vi.fn());

vi.mock("./chat-message-hydration", () => ({
  hydrateClientChatMessages,
}));

const message = (id: string, createdAt: string) => ({
  id,
  conversation_id: "11111111-1111-4111-8111-111111111111",
  sender_id: "22222222-2222-4222-8222-222222222222",
  sender_role: "client" as const,
  body: "hello",
  client_request_id: id,
  created_at: createdAt,
  edited_at: null,
  deleted_at: null,
  pinned_at: null,
  pinned_by: null,
  reply_to_message_id: null,
});

const input = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  text: "hello",
  senderIds: ["22222222-2222-4222-8222-222222222222"],
  mentionedUserIds: [],
  channelIds: [],
  contentKinds: ["file" as const],
  authorTypes: ["client" as const],
  pinned: null,
  dates: [{ operator: "during" as const, date: "2026-07-11", timeZone: "Asia/Manila" }],
  limit: 2,
};

describe("SupabaseChatSearchRepository", () => {
  beforeEach(() => {
    hydrateClientChatMessages.mockReset();
    hydrateClientChatMessages.mockImplementation(async (_client, rows) =>
      rows.map((row: ReturnType<typeof message>) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        senderRole: row.sender_role,
        body: row.body,
        clientRequestId: row.client_request_id,
        createdAt: row.created_at,
      }))
    );
  });

  it("passes every filter to the RLS RPC and returns an ascending page", async () => {
    const rows = [
      message("33333333-3333-4333-8333-333333333333", "2026-07-11T03:00:00Z"),
      message("44444444-4444-4444-8444-444444444444", "2026-07-11T02:00:00Z"),
      message("55555555-5555-4555-8555-555555555555", "2026-07-11T01:00:00Z"),
    ];
    const rpc = vi.fn().mockImplementation(async (name: string) =>
      name === "count_chat_messages" ? { data: 3, error: null } : { data: rows.slice(0, 2), error: null }
    );
    const repository = new SupabaseChatSearchRepository({ rpc } as never);

    const result = await repository.search(input);

    expect(rpc).toHaveBeenCalledWith("search_chat_messages", expect.objectContaining({
      p_conversation_id: input.conversationId,
      p_query: "hello",
      p_sender_ids: input.senderIds,
      p_content_kinds: ["file"],
      p_author_types: ["client"],
      p_dates: input.dates,
      p_limit: 2,
      p_offset: 0,
      p_sort_direction: "desc",
    }));
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_pinned");
    expect(result).toEqual({
      ok: true,
      data: {
        messages: [expect.objectContaining({ id: rows[0].id }), expect.objectContaining({ id: rows[1].id })],
        nextCursor: { createdAt: rows[1].created_at, id: rows[1].id },
        totalCount: 3,
      },
    });
  });

  it("passes pinned false and a keyset cursor without dropping false", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const repository = new SupabaseChatSearchRepository({ rpc } as never);
    const cursor = {
      createdAt: "2026-07-10T00:00:00Z",
      id: "66666666-6666-4666-8666-666666666666",
    };

    await repository.search({ ...input, pinned: false, cursor });

    expect(rpc).toHaveBeenCalledWith("search_chat_messages", expect.objectContaining({
      p_pinned: false,
      p_before_created_at: cursor.createdAt,
      p_before_id: cursor.id,
    }));
  });

  it("maps database errors to calm retry guidance", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "network" } });
    const repository = new SupabaseChatSearchRepository({ rpc } as never);

    await expect(repository.search(input)).resolves.toEqual({
      ok: false,
      notice: "Search is taking a little longer. Check your connection and try again.",
    });
  });
});
