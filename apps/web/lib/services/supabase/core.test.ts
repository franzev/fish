import { describe, expect, it, vi } from "vitest";
import { createSupabaseServices } from "./core";
import type { AppSupabaseClient } from "./types";

function createQueryResult<T>(value: T) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: value, error: null })),
        single: vi.fn(async () => ({ data: value, error: null })),
      })),
    })),
  };
}

function createChainStub<T>(value: T) {
  const result = { data: value, error: null };
  const builder: Record<string, unknown> = {
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (outcome: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  for (const method of ["select", "eq", "in", "order", "limit", "range"]) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

describe("Supabase service registry", () => {
  it("exposes cohesive auth, database, storage, and realtime services over one injected client", async () => {
    const profile = {
      id: "profile-1",
      role: "client",
      display_name: "Franz Fish",
      email: "franz@example.com",
      created_at: "2026-07-04T00:00:00Z",
      updated_at: "2026-07-04T00:00:00Z",
    };
    const bucket = { upload: vi.fn() };
    const channel = { subscribe: vi.fn() };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "profile-1", email: "franz@example.com" } },
          error: null,
        })),
        getClaims: vi.fn(async () => ({ data: { claims: {} }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      from: vi.fn(() => createQueryResult(profile)),
      storage: { from: vi.fn(() => bucket) },
      channel: vi.fn(() => channel),
    } as unknown as AppSupabaseClient;

    const services = createSupabaseServices(client);

    await expect(services.auth.getCurrentUser()).resolves.toMatchObject({
      ok: true,
      data: { id: "profile-1" },
    });
    await expect(services.auth.refreshSessionClaims()).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    await expect(services.database.profiles.findById("profile-1")).resolves.toEqual(
      { ok: true, data: profile }
    );
    expect(services.storage.from("avatars")).toBe(bucket);
    expect(services.realtime.channel("room:1")).toBe(channel);
    expect(services.client).toBe(client);
  });

  it("maps Supabase database failures into centralized service failures", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: { message: "permission denied", code: "42501" },
            })),
          })),
        })),
      })),
    } as unknown as AppSupabaseClient;

    const result = await createSupabaseServices(client).database.profiles.findById(
      "profile-1"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("database");
      expect(result.error.operation).toBe("profiles.findById");
      expect(result.error.details).toEqual({ supabaseCode: "42501" });
    }
  });

  it("treats a missing auth session as a signed-out user, not a service failure", async () => {
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: {
            name: "AuthSessionMissingError",
            message: "Auth session missing!",
            status: 400,
          },
        })),
      },
    } as unknown as AppSupabaseClient;

    await expect(
      createSupabaseServices(client).auth.getCurrentUser()
    ).resolves.toEqual({ ok: true, data: null });
  });

  it("treats a stale auth user token as signed out, not a service failure", async () => {
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: {
            name: "AuthApiError",
            message: "User from sub claim in JWT does not exist",
            code: "user_not_found",
            status: 403,
          },
        })),
      },
    } as unknown as AppSupabaseClient;

    await expect(
      createSupabaseServices(client).auth.getCurrentUser()
    ).resolves.toEqual({ ok: true, data: null });
  });

  it("treats a missing refresh token during session refresh as signed out", async () => {
    const client = {
      auth: {
        getClaims: vi.fn(async () => ({
          data: null,
          error: {
            name: "AuthApiError",
            message: "Invalid Refresh Token: Refresh Token Not Found",
            code: "refresh_token_not_found",
            status: 400,
          },
        })),
      },
    } as unknown as AppSupabaseClient;

    await expect(
      createSupabaseServices(client).auth.refreshSessionClaims()
    ).resolves.toEqual({ ok: true, data: undefined });
  });

  it("starts Google OAuth with the provided callback URL", async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: { provider: "google", url: "https://accounts.google.com" },
      error: null,
    }));
    const client = {
      auth: { signInWithOAuth },
    } as unknown as AppSupabaseClient;

    await expect(
      createSupabaseServices(client).auth.signInWithGoogle(
        "http://localhost:3001/auth/callback"
      )
    ).resolves.toEqual({ ok: true, data: undefined });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3001/auth/callback" },
    });
  });

  it("exposes the general channel identity for the demo community conversation", async () => {
    const demoConversationId = "11111111-1111-4111-8111-111111111111";
    const tables: Record<string, unknown> = {
      profiles: { id: "user-1", role: "client", display_name: "Franz Fish" },
      conversations: {
        id: demoConversationId,
        client_id: "user-1",
        coach_id: "coach-1",
      },
      messages: [],
      message_reactions: [],
      message_reads: [],
      presence_sessions: [],
    };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => createChainStub(tables[table])),
    } as unknown as AppSupabaseClient;

    const result = await createSupabaseServices(
      client
    ).database.chat.getAssignedConversation();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        conversationId: demoConversationId,
        kind: "community",
        channelId: "22222222-2222-4222-8222-222222222222",
        channelSlug: "general",
        channelName: "general",
        title: "general",
      });
      expect(result.data?.subtitle).toBeUndefined();
      expect(client.from).not.toHaveBeenCalledWith("message_reactions");
    }
  });

  it("leaves channel identity unset for a direct 1-on-1 conversation", async () => {
    // Each from() call per table consumes the next queued value: profiles is
    // read for the current user then the participant; conversations misses
    // the demo-community lookup, then returns the assigned direct one.
    const queues: Record<string, unknown[]> = {
      profiles: [
        { id: "user-1", role: "client", display_name: "Franz Fish" },
        { id: "coach-1", role: "coach", display_name: "Coach Dana" },
      ],
      conversations: [
        null,
        [{ id: "conversation-1", client_id: "user-1", coach_id: "coach-1" }],
      ],
      messages: [[]],
      message_reactions: [[]],
      message_reads: [[]],
      presence_sessions: [[]],
    };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        const queue = queues[table] ?? [];
        return createChainStub(queue.length > 1 ? queue.shift() : queue[0]);
      }),
    } as unknown as AppSupabaseClient;

    const result = await createSupabaseServices(
      client
    ).database.chat.getAssignedConversation();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        conversationId: "conversation-1",
        kind: "direct",
      });
      expect(result.data?.channelId).toBeUndefined();
      expect(result.data?.channelSlug).toBeUndefined();
      expect(result.data?.channelName).toBeUndefined();
    }
  });

  it("bounds the initial message window to 40 and reports hasMoreOlder for a long conversation", async () => {
    const demoConversationId = "11111111-1111-4111-8111-111111111111";
    const totalMessages = 41;
    // Seeded newest-first (DESC), matching what the bounded keyset query
    // returns before app code reverses it back to ascending.
    const messageRows = Array.from({ length: totalMessages }, (_, index) => {
      const position = totalMessages - 1 - index; // 40 (newest) down to 0 (oldest)
      const minute = String(position).padStart(2, "0");
      return {
        id: `message-${String(position).padStart(3, "0")}`,
        conversation_id: demoConversationId,
        sender_id: "user-1",
        sender_role: "client",
        body: `Message ${position}`,
        client_request_id: `request-${position}`,
        created_at: `2026-07-05T00:${minute}:00.000Z`,
        edited_at: null,
        deleted_at: null,
        reply_to_message_id: null,
      };
    });
    const queues: Record<string, unknown[]> = {
      profiles: [
        { id: "user-1", role: "client", display_name: "Franz Fish" },
        [{ id: "user-1", display_name: "Franz Fish" }],
      ],
    };
    const tables: Record<string, unknown> = {
      conversations: {
        id: demoConversationId,
        client_id: "user-1",
        coach_id: "coach-1",
      },
      messages: messageRows,
      message_reads: [],
      presence_sessions: [],
    };
    const reactionRows = [
      {
        id: "reaction-retained",
        conversation_id: demoConversationId,
        message_id: "message-040",
        user_id: "user-1",
        emoji: "👍",
        removed_at: null,
        created_at: "2026-07-05T01:00:00.000Z",
      },
      {
        id: "reaction-excluded",
        conversation_id: demoConversationId,
        message_id: "message-000",
        user_id: "coach-1",
        emoji: "👎",
        removed_at: null,
        created_at: "2026-07-05T01:01:00.000Z",
      },
    ];
    const reactionConversationIds: string[] = [];
    const reactionMessageIdBatches: string[][] = [];
    const createReactionChain = () => {
      let conversationId: string | null = null;
      let messageIds: string[] | null = null;
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: string) => {
          if (column === "conversation_id") {
            conversationId = value;
            reactionConversationIds.push(value);
          }
          return builder;
        }),
        in: vi.fn((column: string, values: string[]) => {
          if (column === "message_id") {
            messageIds = values;
            reactionMessageIdBatches.push(values);
          }
          return builder;
        }),
        range: vi.fn(() => builder),
        then: (
          resolve: (outcome: { data: typeof reactionRows; error: null }) => unknown
        ) => {
          const data = reactionRows.filter(
            (reaction) =>
              (!conversationId || reaction.conversation_id === conversationId) &&
              (!messageIds || messageIds.includes(reaction.message_id))
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          const queue = queues.profiles;
          return createChainStub(queue.length > 1 ? queue.shift() : queue[0]);
        }
        if (table === "message_reactions") {
          return createReactionChain();
        }
        return createChainStub(tables[table]);
      }),
    } as unknown as AppSupabaseClient;

    const result = await createSupabaseServices(
      client
    ).database.chat.getAssignedConversation();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.messages).toHaveLength(40);
      expect(result.data?.hasMoreOlder).toBe(true);
      // Ascending order preserved; the oldest kept message is position 1 (the
      // very oldest of all 41, position 0, fell outside the 40-message window).
      expect(result.data?.messages[0]?.id).toBe("message-001");
      expect(result.data?.messages[39]?.id).toBe("message-040");
      expect(result.data?.oldestCursor).toEqual({
        createdAt: "2026-07-05T00:01:00.000Z",
        id: "message-001",
      });
      expect(reactionConversationIds).toEqual([
        demoConversationId,
        demoConversationId,
      ]);
      expect(reactionMessageIdBatches.every((ids) => ids.length <= 25)).toBe(true);
      expect(new Set(reactionMessageIdBatches.flat())).toEqual(
        new Set(result.data?.messages.map((message) => message.id))
      );
      expect(
        reactionMessageIdBatches.some((ids) => ids.includes("message-000"))
      ).toBe(false);
      expect(result.data?.messages[39]?.reactions).toEqual([
        { emoji: "👍", count: 1, byMe: true },
      ]);
      expect(
        result.data?.messages.flatMap((message) => message.reactions ?? [])
      ).not.toContainEqual(expect.objectContaining({ emoji: "👎" }));
    }
  });

  it("returns every message and hasMoreOlder false for a short conversation", async () => {
    const demoConversationId = "11111111-1111-4111-8111-111111111111";
    const messageRows = [0, 1, 2]
      .map((position) => ({
        id: `message-${position}`,
        conversation_id: demoConversationId,
        sender_id: "user-1",
        sender_role: "client",
        body: `Message ${position}`,
        client_request_id: `request-${position}`,
        created_at: `2026-07-05T00:0${position}:00.000Z`,
        edited_at: null,
        deleted_at: null,
        reply_to_message_id: null,
      }))
      .reverse(); // seeded newest-first, matching the DESC keyset query
    const queues: Record<string, unknown[]> = {
      profiles: [
        { id: "user-1", role: "client", display_name: "Franz Fish" },
        [{ id: "user-1", display_name: "Franz Fish" }],
      ],
    };
    const tables: Record<string, unknown> = {
      conversations: {
        id: demoConversationId,
        client_id: "user-1",
        coach_id: "coach-1",
      },
      messages: messageRows,
      message_reactions: [],
      message_reads: [],
      presence_sessions: [],
    };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          const queue = queues.profiles;
          return createChainStub(queue.length > 1 ? queue.shift() : queue[0]);
        }
        return createChainStub(tables[table]);
      }),
    } as unknown as AppSupabaseClient;

    const result = await createSupabaseServices(
      client
    ).database.chat.getAssignedConversation();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.messages).toHaveLength(3);
      expect(result.data?.hasMoreOlder).toBe(false);
      expect(result.data?.messages.map((message) => message.id)).toEqual([
        "message-0",
        "message-1",
        "message-2",
      ]);
      expect(result.data?.oldestCursor).toEqual({
        createdAt: "2026-07-05T00:00:00.000Z",
        id: "message-0",
      });
    }
  });

  it("maps Google OAuth start failures into auth service failures", async () => {
    const client = {
      auth: {
        signInWithOAuth: vi.fn(async () => ({
          data: { provider: "google", url: null },
          error: { message: "provider unavailable", code: "provider_disabled" },
        })),
      },
    } as unknown as AppSupabaseClient;

    const result = await createSupabaseServices(client).auth.signInWithGoogle(
      "http://localhost:3001/auth/callback"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("auth");
      expect(result.error.operation).toBe("auth.signInWithGoogle");
      expect(result.error.details).toEqual({
        supabaseCode: "provider_disabled",
      });
    }
  });
});
