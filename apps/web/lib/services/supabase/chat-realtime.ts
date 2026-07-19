import {
  reportFailedResult,
  reportOperationalError,
} from "@/lib/observability/reporter";
import type {
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import type { ChatRealtimeService } from "../contracts";
import { createBrowserSupabaseClient } from "./browser";
import type { AppSupabaseClient } from "./types";
import type { MessageReadRow, MessageRow } from "@fish/supabase";
import { chatTypingContract, type ChatTypingPayload } from "@fish/core";
import {
  toClientChatMessage as mapClientChatMessage,
  toClientReadState as mapClientReadState,
  type MessageResponseRow,
} from "./chat-mapping";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";

interface TypingBroadcastPayload {
  payload?: Partial<ChatTypingPayload>;
}

export interface ConversationTypingSubscription {
  sendTyping: (typing: boolean) => void;
  unsubscribe: () => void;
}

interface DeferredChannel {
  getChannel: () => RealtimeChannel | null;
  unsubscribe: () => void;
}

// Realtime joins snapshot the client's current access token. On a full page
// load the session is still being restored while chat mounts, so an immediate
// subscribe joins as `anon` — Postgres then rejects the postgres_changes
// registration (silently: the join itself still acks SUBSCRIBED) and the page
// sits believed-connected but dead until the next client-side remount. Wait
// for the session and hand it to realtime before opening any channel.
function subscribeAfterAuth(
  build: (supabase: AppSupabaseClient) => RealtimeChannel
): DeferredChannel {
  const supabase = createBrowserSupabaseClient();
  let channel: RealtimeChannel | null = null;
  let disposed = false;

  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        await supabase.realtime.setAuth(accessToken);
      }
    } catch (error) {
      reportOperationalError(error, {
        operation: "realtime.chat.authenticate",
        handled: true,
        recoverable: true,
        runtime: "browser",
      });
      // Session lookup failed; subscribe with whatever auth the client holds.
    }

    if (!disposed) {
      channel = build(supabase);
    }
  })();

  return {
    getChannel: () => channel,
    unsubscribe: () => {
      disposed = true;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}

function isChatSenderRole(value: string): value is ClientChatMessage["senderRole"] {
  return value === "client" || value === "coach";
}

function toRealtimeChatMessage(row: MessageRow): ClientChatMessage | null {
  if (!isChatSenderRole(row.sender_role)) {
    return null;
  }
  return mapClientChatMessage({
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    sender_role: row.sender_role,
    sender_display_name: null,
    body: row.body,
    client_request_id: row.client_request_id,
    created_at: row.created_at,
    edited_at: "edited_at" in row ? row.edited_at ?? null : null,
    deleted_at: "deleted_at" in row ? row.deleted_at ?? null : null,
    reply_to_message_id: "reply_to_message_id" in row ? row.reply_to_message_id ?? null : null,
    sticker_id: "sticker_id" in row ? row.sticker_id ?? null : null,
    reactions: [],
    images: [],
  } satisfies MessageResponseRow);
}

function toRealtimeReadState(row: MessageReadRow): ClientChatReadState {
  return mapClientReadState({
    user_id: row.user_id,
    last_delivered_message_id: "last_delivered_message_id" in row ? row.last_delivered_message_id ?? null : null,
    delivered_at: "delivered_at" in row ? row.delivered_at ?? null : null,
    last_read_message_id: row.last_read_message_id,
    read_at: row.read_at,
  });
}

export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: ClientChatMessage) => void,
  onReconnected?: () => void,
  onDisconnected?: () => void
): () => void {
  const deferred = subscribeAfterAuth((supabase) => supabase
    .channel(`conversation:${conversationId}:messages`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: RealtimePostgresInsertPayload<MessageRow>) => {
        const message = toRealtimeChatMessage(payload.new);
        if (message) {
          onMessage(message);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: RealtimePostgresUpdatePayload<MessageRow>) => {
        const message = toRealtimeChatMessage(payload.new);
        if (message) {
          onMessage(message);
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onReconnected?.();
        return;
      }

      // Terminal/error states (CLOAD-06): surface these so the caller can
      // flip the store's realtime status to "disconnected" — the calm
      // offline signal Plan 04's UI renders. SUBSCRIBED above is the only
      // status that restores "connected".
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        onDisconnected?.();
        if (status !== "CLOSED") {
          reportFailedResult({ ok: false, code: status }, {
            operation: "realtime.chat.messages.subscribe",
            recoverable: true,
            runtime: "browser",
          });
        }
      }
    }));

  return deferred.unsubscribe;
}

export function subscribeToConversationReadStates(
  conversationId: string,
  onReadState: (readState: ClientChatReadState) => void,
  onReconnected?: () => void
): () => void {
  const deferred = subscribeAfterAuth((supabase) => supabase
    .channel(`conversation:${conversationId}:reads`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_reads",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: RealtimePostgresChangesPayload<MessageReadRow>) => {
        if ("new" in payload && payload.new) {
          onReadState(toRealtimeReadState(payload.new as MessageReadRow));
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onReconnected?.();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reportFailedResult({ ok: false, code: status }, {
          operation: "realtime.chat.reads.subscribe",
          recoverable: true,
          runtime: "browser",
        });
      }
    }));

  return deferred.unsubscribe;
}

export function subscribeToConversationReactionChanges(
  conversationId: string,
  onReactionChange: (messageId: string) => void,
  onReconnected?: () => void
): () => void {
  const deferred = subscribeAfterAuth((supabase) => supabase
    .channel(`conversation:${conversationId}:reactions`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_reactions",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: RealtimePostgresChangesPayload<{
        message_id?: string;
        conversation_id?: string;
      }>) => {
        const row = ("new" in payload && payload.new
          ? payload.new
          : "old" in payload
            ? payload.old
            : null) as { message_id?: string } | null;
        const messageId = row?.message_id;
        if (typeof messageId === "string") {
          onReactionChange(messageId);
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onReconnected?.();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reportFailedResult({ ok: false, code: status }, {
          operation: "realtime.chat.reactions.subscribe",
          recoverable: true,
          runtime: "browser",
        });
      }
    }));

  return deferred.unsubscribe;
}

export function subscribeToConversationTyping(
  conversationId: string,
  currentUserId: string,
  onTypingChange: (typing: boolean) => void
): ConversationTypingSubscription {
  const deferred = subscribeAfterAuth((supabase) => supabase
    .channel(chatTypingContract.topic(conversationId), {
      config: {
        broadcast: { self: chatTypingContract.receiveOwnBroadcasts },
      },
    })
    .on(
      "broadcast",
      { event: chatTypingContract.event },
      (event: TypingBroadcastPayload) => {
        const { userId, typing } = event.payload ?? {};

        if (typeof userId !== "string" || userId === currentUserId) {
          return;
        }

        if (typeof typing === "boolean") {
          onTypingChange(typing);
        }
      }
    )
    .subscribe());

  return {
    sendTyping(typing) {
      void deferred.getChannel()?.send({
        type: "broadcast",
        event: chatTypingContract.event,
        payload: {
          userId: currentUserId,
          typing,
        },
      });
    },
    unsubscribe: deferred.unsubscribe,
  };
}

export const supabaseChatRealtimeService: ChatRealtimeService = {
  subscribeToMessages: subscribeToConversationMessages,
  subscribeToReadStates: subscribeToConversationReadStates,
  subscribeToReactionChanges: subscribeToConversationReactionChanges,
  subscribeToTyping: subscribeToConversationTyping,
};
