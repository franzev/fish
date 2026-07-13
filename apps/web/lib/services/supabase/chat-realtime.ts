import type {
  ClientChatMessage,
  ClientChatPresenceSession,
  ClientChatReadState,
} from "@/lib/services";
import type { ChatRealtimeService } from "../contracts";
import { createBrowserSupabaseClient } from "./browser";
import type { AppSupabaseClient } from "./types";
import type { MessageReadRow, MessageRow } from "@fish/supabase";
import { readChatStickerId } from "./chat-mapping";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";

interface TypingPayload {
  userId: string;
  typing: boolean;
}

interface VoiceRecordingPayload {
  userId: string;
  recording: boolean;
}

interface TypingBroadcastPayload {
  payload?: Partial<TypingPayload>;
}

interface VoiceRecordingBroadcastPayload {
  payload?: Partial<VoiceRecordingPayload>;
}

export interface ConversationTypingSubscription {
  sendTyping: (typing: boolean) => void;
  unsubscribe: () => void;
}

export interface ConversationVoiceRecordingSubscription {
  sendRecording: (recording: boolean) => void;
  unsubscribe: () => void;
}

export interface PresenceSessionController {
  markActive: () => void;
  stop: () => void;
}

type PresenceSessionRow = {
  id: string;
  user_id: string;
  active_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
};

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
    } catch {
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

function toClientChatMessage(row: MessageRow): ClientChatMessage | null {
  if (!isChatSenderRole(row.sender_role)) {
    return null;
  }
  const stickerId = readChatStickerId(row.sticker_id);

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    editedAt: "edited_at" in row ? row.edited_at ?? null : null,
    deletedAt: "deleted_at" in row ? row.deleted_at ?? null : null,
    replyToMessageId: "reply_to_message_id" in row ? row.reply_to_message_id ?? null : null,
    ...(stickerId ? { stickerId } : {}),
    reactions: [],
    images: [],
  };
}

function toClientChatReadState(row: MessageReadRow): ClientChatReadState {
  return {
    userId: row.user_id,
    lastDeliveredMessageId:
      "last_delivered_message_id" in row
        ? row.last_delivered_message_id ?? null
        : null,
    deliveredAt: "delivered_at" in row ? row.delivered_at ?? null : null,
    lastReadMessageId: row.last_read_message_id,
    readAt: row.read_at,
  };
}

function toClientPresenceSession(
  row: PresenceSessionRow
): ClientChatPresenceSession {
  return {
    id: row.id,
    userId: row.user_id,
    activeAt: row.active_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    endedAt: row.ended_at,
  };
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
        const message = toClientChatMessage(payload.new);
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
        const message = toClientChatMessage(payload.new);
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
          onReadState(toClientChatReadState(payload.new as MessageReadRow));
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onReconnected?.();
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
      }
    }));

  return deferred.unsubscribe;
}

export function subscribeToParticipantPresence(
  participantId: string,
  onPresenceSession: (
    session: ClientChatPresenceSession,
    eventType: "INSERT" | "UPDATE" | "DELETE"
  ) => void
): () => void {
  const deferred = subscribeAfterAuth((supabase) => supabase
    .channel(`presence:${participantId}:sessions`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "presence_sessions",
        filter: `user_id=eq.${participantId}`,
      },
      (payload: RealtimePostgresChangesPayload<PresenceSessionRow>) => {
        const row = "new" in payload && payload.new ? payload.new : payload.old;
        if (!row) {
          return;
        }

        onPresenceSession(
          toClientPresenceSession(row as PresenceSessionRow),
          payload.eventType
        );
      }
    )
    .subscribe());

  return deferred.unsubscribe;
}

export function subscribeToConversationTyping(
  conversationId: string,
  currentUserId: string,
  onTypingChange: (typing: boolean) => void
): ConversationTypingSubscription {
  const deferred = subscribeAfterAuth((supabase) => supabase
    .channel(`conversation:${conversationId}:typing`, {
      config: {
        broadcast: { self: false },
      },
    })
    .on("broadcast", { event: "typing" }, (event: TypingBroadcastPayload) => {
      const { userId, typing } = event.payload ?? {};

      if (typeof userId !== "string" || userId === currentUserId) {
        return;
      }

      if (typeof typing === "boolean") {
        onTypingChange(typing);
      }
    })
    .subscribe());

  return {
    sendTyping(typing) {
      void deferred.getChannel()?.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: currentUserId,
          typing,
        },
      });
    },
    unsubscribe: deferred.unsubscribe,
  };
}

export function subscribeToConversationVoiceRecording(
  conversationId: string,
  currentUserId: string,
  onRecordingChange: (recording: boolean) => void
): ConversationVoiceRecordingSubscription {
  const deferred = subscribeAfterAuth((supabase) => supabase
    .channel(`conversation:${conversationId}:voice-recording`, {
      config: {
        broadcast: { self: false },
      },
    })
    .on(
      "broadcast",
      { event: "voice-recording" },
      (event: VoiceRecordingBroadcastPayload) => {
        const { userId, recording } = event.payload ?? {};

        if (typeof userId !== "string" || userId === currentUserId) {
          return;
        }

        if (typeof recording === "boolean") {
          onRecordingChange(recording);
        }
      }
    )
    .subscribe());

  return {
    sendRecording(recording) {
      void deferred.getChannel()?.send({
        type: "broadcast",
        event: "voice-recording",
        payload: {
          userId: currentUserId,
          recording,
        },
      });
    },
    unsubscribe: deferred.unsubscribe,
  };
}

function makePresenceSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `presence-${Date.now()}`;
}

export function startPresenceSession(
  currentUserId: string
): PresenceSessionController {
  const supabase = createBrowserSupabaseClient();
  const sessionId = makePresenceSessionId();
  let activeAt = new Date().toISOString();
  let stopped = false;
  let lastActiveSentAt = 0;

  function writePresence(ended = false) {
    const now = new Date().toISOString();
    void supabase.from("presence_sessions").upsert(
      {
        id: sessionId,
        user_id: currentUserId,
        active_at: activeAt,
        last_heartbeat_at: now,
        ended_at: ended ? now : null,
      },
      { onConflict: "id" }
    );
  }

  function markActive() {
    if (stopped) {
      return;
    }

    const now = Date.now();
    if (now - lastActiveSentAt < 5000) {
      return;
    }

    lastActiveSentAt = now;
    activeAt = new Date(now).toISOString();
    writePresence(false);
  }

  writePresence(false);
  const interval = setInterval(() => writePresence(false), 25000);
  const activityEvents = ["pointerdown", "keydown", "focus"] as const;
  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, markActive, { passive: true });
  });

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    clearInterval(interval);
    activityEvents.forEach((eventName) => {
      window.removeEventListener(eventName, markActive);
    });
    writePresence(true);
  };

  window.addEventListener("pagehide", stop, { once: true });

  return {
    markActive,
    stop() {
      window.removeEventListener("pagehide", stop);
      stop();
    },
  };
}

export const supabaseChatRealtimeService: ChatRealtimeService = {
  subscribeToMessages: subscribeToConversationMessages,
  subscribeToReadStates: subscribeToConversationReadStates,
  subscribeToReactionChanges: subscribeToConversationReactionChanges,
  subscribeToParticipantPresence,
  subscribeToTyping: subscribeToConversationTyping,
  subscribeToRecording: subscribeToConversationVoiceRecording,
  startPresenceSession,
};
