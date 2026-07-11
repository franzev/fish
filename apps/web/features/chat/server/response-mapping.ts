import type { ClientChatMessage, ClientChatReadState } from "@/lib/services";

export type MessageResponseRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "client" | "coach";
  sender_display_name?: string | null;
  senderDisplayName?: string | null;
  body: string;
  client_request_id: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
  reactions?: Array<{
    emoji: string;
    count: number;
    by_me?: boolean;
    byMe?: boolean;
  }>;
};

export type ReadStateResponseRow = {
  user_id: string;
  last_delivered_message_id: string | null;
  delivered_at: string | null;
  last_read_message_id: string | null;
  read_at: string | null;
};

export type ChatCommand =
  | {
      action: "edit-message";
      messageId: string;
      body: string;
    }
  | {
      action: "delete-message";
      messageId: string;
    }
  | {
      action: "toggle-reaction";
      messageId: string;
      emoji: string;
    };

export function toClientChatMessage(row: MessageResponseRow): ClientChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    senderDisplayName: row.senderDisplayName ?? row.sender_display_name ?? null,
    body: row.body,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null,
    replyToMessageId: row.reply_to_message_id ?? null,
    reactions: (row.reactions ?? []).map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      byMe: reaction.byMe ?? reaction.by_me ?? false,
    })),
  };
}

export function toClientReadState(row: ReadStateResponseRow): ClientChatReadState {
  return {
    userId: row.user_id,
    lastDeliveredMessageId: row.last_delivered_message_id,
    deliveredAt: row.delivered_at,
    lastReadMessageId: row.last_read_message_id,
    readAt: row.read_at,
  };
}
