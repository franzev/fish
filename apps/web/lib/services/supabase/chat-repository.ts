import { generalChannelId, generalChannelName, generalChannelSlug } from "@/lib/channels";
import { serviceFailure, serviceSuccess, type ServiceResult } from "@/lib/services/errors";
import type {
  ConversationRow,
  MessageAttachmentRow,
  MessageGifRow,
  MessageReactionRow,
  MessageReadRow,
  MessageRow,
  PresenceSessionRow,
  ProfileRow,
} from "@fish/supabase";
import { mapSupabaseError, safely, type SupabaseResponse } from "./shared";
import type {
  ChatRepository,
  ClientChatData,
  ClientChatMessage,
} from "../contracts";
import type { AppSupabaseClient } from "./types";

const demoCommunityConversationId = "11111111-1111-4111-8111-111111111111";
const demoCommunityTitle = "FISH Community";
const reactionPageSize = 1000;
const reactionMessageBatchSize = 25;
// Bounded newest-message window for the initial SSR load (CLOAD-01). One
// reusable page size keeps the initial fetch and every later "load earlier"
// page (Plan 10-02 actions.ts) consistent.
const chatInitialWindowSize = 40;


async function fetchConversationReactions(
  client: AppSupabaseClient,
  conversationId: string,
  messageIds: string[]
): Promise<{ data: MessageReactionRow[]; error: SupabaseResponse<unknown>["error"] }> {
  const rows: MessageReactionRow[] = [];

  if (messageIds.length === 0) {
    return { data: rows, error: null };
  }

  for (
    let batchStart = 0;
    batchStart < messageIds.length;
    batchStart += reactionMessageBatchSize
  ) {
    const batchIds = messageIds.slice(
      batchStart,
      batchStart + reactionMessageBatchSize
    );

    for (let from = 0;; from += reactionPageSize) {
      const { data, error } = (await client
        .from("message_reactions")
        .select("*")
        .eq("conversation_id", conversationId)
        .in("message_id", batchIds)
        .range(from, from + reactionPageSize - 1)) as {
        data: MessageReactionRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (error) {
        return { data: rows, error };
      }

      rows.push(...(data ?? []));
      if ((data ?? []).length < reactionPageSize) {
        break;
      }
    }
  }

  return { data: rows, error: null };
}




export class SupabaseChatRepository implements ChatRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async getAssignedConversation(): Promise<ServiceResult<ClientChatData | null>> {
    return safely("chat.getAssignedConversation", async () => {
      const { data: userData, error: userError } = await this.client.auth.getUser();
      if (userError) {
        return serviceFailure(
          mapSupabaseError(userError, {
            code: "auth",
            fallbackMessage: "Could not read the current user.",
            operation: "chat.getAssignedConversation",
            recoverable: true,
          })
        );
      }

      const userId = userData.user?.id;
      if (!userId) return serviceSuccess(null);

      const { data: profile, error: profileError } = (await this.client
        .from("profiles")
        .select("id, role, display_name")
        .eq("id", userId)
        .maybeSingle()) as SupabaseResponse<Pick<ProfileRow, "id" | "role" | "display_name">>;

      if (profileError) {
        return serviceFailure(
          mapSupabaseError(profileError, {
            code: "database",
            fallbackMessage: "Could not load your profile.",
            operation: "chat.getAssignedConversation.profile",
            recoverable: true,
          })
        );
      }

      if (!profile || (profile.role !== "client" && profile.role !== "coach")) {
        return serviceSuccess(null);
      }

      const { data: demoConversation, error: demoConversationError } =
        (await this.client
          .from("conversations")
          .select("*")
          .eq("id", demoCommunityConversationId)
          .maybeSingle()) as SupabaseResponse<ConversationRow>;

      if (demoConversationError) {
        return serviceFailure(
          mapSupabaseError(demoConversationError, {
            code: "database",
            fallbackMessage: "Could not load the community room.",
            operation: "chat.getAssignedConversation.demoConversation",
            recoverable: true,
          })
        );
      }

      let conversation = demoConversation;

      if (!conversation) {
        const { data: conversations, error: conversationError } = (await this.client
          .from("conversations")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(1)) as {
          data: ConversationRow[] | null;
          error: SupabaseResponse<unknown>["error"];
        };

        if (conversationError) {
          return serviceFailure(
            mapSupabaseError(conversationError, {
              code: "database",
              fallbackMessage: "Could not load your conversation.",
              operation: "chat.getAssignedConversation.conversation",
              recoverable: true,
            })
          );
        }

        conversation = conversations?.[0] ?? null;
      }

      if (!conversation) return serviceSuccess(null);

      const isDemoCommunity = conversation.id === demoCommunityConversationId;
      let participant: Pick<ProfileRow, "id" | "role" | "display_name"> = {
        id: demoCommunityConversationId,
        role: "coach",
        display_name: demoCommunityTitle,
      };

      if (!isDemoCommunity) {
        const participantId = conversation.client_id === userId
          ? conversation.coach_id
          : conversation.client_id;
        const { data: directParticipant, error: participantError } =
          (await this.client
            .from("profiles")
            .select("id, role, display_name")
            .eq("id", participantId)
            .maybeSingle()) as SupabaseResponse<
            Pick<ProfileRow, "id" | "role" | "display_name">
          >;

        if (participantError) {
          return serviceFailure(
            mapSupabaseError(participantError, {
              code: "database",
              fallbackMessage: "Could not load the conversation member.",
              operation: "chat.getAssignedConversation.participant",
              recoverable: true,
            })
          );
        }

        if (
          !directParticipant ||
          (directParticipant.role !== "client" && directParticipant.role !== "coach")
        ) {
          return serviceSuccess(null);
        }

        participant = directParticipant;
      }

      // Keyset window: newest-first + N+1 limit tells us hasMoreOlder without
      // a second round trip. `messages_conversation_created_id_idx` (0010)
      // already covers this DESC,DESC scan direction — see plan migration note.
      const { data: messageWindow, error: messageError } = (await this.client
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(chatInitialWindowSize + 1)) as {
        data: MessageRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (messageError) {
        return serviceFailure(
          mapSupabaseError(messageError, {
            code: "database",
            fallbackMessage: "Could not load messages.",
            operation: "chat.getAssignedConversation.messages",
            recoverable: true,
          })
        );
      }

      const messageRows = messageWindow ?? [];
      const hasMoreOlder = messageRows.length > chatInitialWindowSize;
      // Bound to the window, then reverse back to ascending — the order the
      // reducer/UI expect and that `hydrateConversation`/`hydrateWindow` render.
      const messages = messageRows.slice(0, chatInitialWindowSize).reverse();
      const oldestCursor =
        messages.length > 0
          ? { createdAt: messages[0].created_at, id: messages[0].id }
          : null;

      const senderIds = Array.from(
        new Set(messages.map((message) => message.sender_id))
      );
      const senderDisplayNames = new Map<string, string>();

      if (senderIds.length > 0) {
        const { data: senderProfiles, error: senderProfileError } =
          (await this.client
            .from("profiles")
            .select("id, display_name")
            .in("id", senderIds)) as {
            data: Array<Pick<ProfileRow, "id" | "display_name">> | null;
            error: SupabaseResponse<unknown>["error"];
          };

        if (senderProfileError) {
          return serviceFailure(
            mapSupabaseError(senderProfileError, {
              code: "database",
              fallbackMessage: "Could not load message senders.",
              operation: "chat.getAssignedConversation.senderProfiles",
              recoverable: true,
            })
          );
        }

        for (const senderProfile of senderProfiles ?? []) {
          senderDisplayNames.set(senderProfile.id, senderProfile.display_name);
        }
      }

      const { data: reactions, error: reactionError } =
        await fetchConversationReactions(
          this.client,
          conversation.id,
          messages.map((message) => message.id)
        );

      if (reactionError) {
        return serviceFailure(
          mapSupabaseError(reactionError, {
            code: "database",
            fallbackMessage: "Could not load message reactions.",
            operation: "chat.getAssignedConversation.reactions",
            recoverable: true,
          })
        );
      }

      const messageIds = messages.map((message) => message.id);
      const { data: attachmentRows, error: attachmentError } = messageIds.length > 0
        ? (await this.client
            .from("message_attachments")
            .select("*")
            .in("message_id", messageIds)
            .eq("status", "ready")
            .order("position", { ascending: true })) as {
            data: MessageAttachmentRow[] | null;
            error: SupabaseResponse<unknown>["error"];
          }
        : { data: [] as MessageAttachmentRow[], error: null };
      if (attachmentError) {
        return serviceFailure(
          mapSupabaseError(attachmentError, {
            code: "database",
            fallbackMessage: "Could not load message images.",
            operation: "chat.getAssignedConversation.attachments",
            recoverable: true,
          })
        );
      }
      const imagePaths = (attachmentRows ?? []).flatMap((image) =>
        [image.thumbnail_path, image.display_path].filter((path): path is string => Boolean(path))
      );
      const signedImages = imagePaths.length > 0
        ? await this.client.storage.from("chat-images").createSignedUrls(imagePaths, 15 * 60)
        : { data: [], error: null };
      const imageUrls = new Map(
        (signedImages.data ?? []).flatMap((item) =>
          item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []
        )
      );

      const { data: gifRows, error: gifError } = messageIds.length > 0
        ? (await this.client
            .from("message_gifs")
            .select("*")
            .in("message_id", messageIds)) as {
            data: MessageGifRow[] | null;
            error: SupabaseResponse<unknown>["error"];
          }
        : { data: [] as MessageGifRow[], error: null };
      if (gifError) {
        return serviceFailure(
          mapSupabaseError(gifError, {
            code: "database",
            fallbackMessage: "Could not load message GIFs.",
            operation: "chat.getAssignedConversation.gifs",
            recoverable: true,
          })
        );
      }

      const { data: readStates, error: readStateError } = (await this.client
        .from("message_reads")
        .select("*")
        .eq("conversation_id", conversation.id)) as {
        data: MessageReadRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (readStateError) {
        return serviceFailure(
          mapSupabaseError(readStateError, {
            code: "database",
            fallbackMessage: "Could not load message read state.",
            operation: "chat.getAssignedConversation.reads",
            recoverable: true,
          })
        );
      }

      const { data: presenceSessions, error: presenceError } = (await this.client
        .from("presence_sessions")
        .select("*")
        .eq("user_id", participant.id)
        .order("last_heartbeat_at", { ascending: false })
        .limit(20)) as {
        data: PresenceSessionRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (presenceError) {
        return serviceFailure(
          mapSupabaseError(presenceError, {
            code: "database",
            fallbackMessage: "Could not load presence.",
            operation: "chat.getAssignedConversation.presence",
            recoverable: true,
          })
        );
      }

      const participantRole = participant.role === "client" ? "client" : "coach";

      const { data: availableChannels, error: availableChannelsError } =
        (await this.client
          .from("channels")
          .select("id, name, slug, conversation_id")
          .order("name")) as {
          data: Array<{
            id: string;
            name: string;
            slug: string;
            conversation_id: string;
          }> | null;
          error: SupabaseResponse<unknown>["error"];
        };
      if (availableChannelsError) {
        return serviceFailure(
          mapSupabaseError(availableChannelsError, {
            code: "database",
            fallbackMessage: "Could not load channels.",
            operation: "chat.getAssignedConversation.searchChannels",
            recoverable: true,
          })
        );
      }
      const { data: channelMemberRows, error: channelMemberError } =
        isDemoCommunity
          ? (await this.client
              .from("channel_members")
              .select("user_id")
              .eq("channel_id", generalChannelId)) as {
              data: Array<{ user_id: string }> | null;
              error: SupabaseResponse<unknown>["error"];
            }
          : { data: [], error: null };
      if (channelMemberError) {
        return serviceFailure(
          mapSupabaseError(channelMemberError, {
            code: "database",
            fallbackMessage: "Could not load channel members.",
            operation: "chat.getAssignedConversation.channelMembers",
            recoverable: true,
          })
        );
      }
      const searchMemberIds = isDemoCommunity
        ? Array.from(new Set((channelMemberRows ?? []).map((row) => row.user_id)))
        : Array.from(new Set([userId, participant.id]));
      const { data: searchMemberProfiles, error: searchMemberError } =
        searchMemberIds.length > 0
          ? (await this.client
              .from("profiles")
              .select("id, display_name, username")
              .in("id", searchMemberIds)
              .order("display_name")) as {
              data: Array<{
                id: string;
                display_name: string;
                username: string;
              }> | null;
              error: SupabaseResponse<unknown>["error"];
            }
          : { data: [], error: null };

      if (searchMemberError) {
        return serviceFailure(
          mapSupabaseError(searchMemberError, {
            code: "database",
            fallbackMessage: "Could not load channel members.",
            operation: "chat.getAssignedConversation.searchMembers",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({
        conversationId: conversation.id,
        kind: isDemoCommunity ? "community" : "direct",
        channelId: isDemoCommunity ? generalChannelId : undefined,
        channelSlug: isDemoCommunity ? generalChannelSlug : undefined,
        channelName: isDemoCommunity ? generalChannelName : undefined,
        // The simplified header renders "# general" from the channel name;
        // the old "FISH Community"/"Community room" title/subtitle pair is retired.
        title: isDemoCommunity ? generalChannelName : undefined,
        currentUserId: userId,
        currentUserRole: profile.role,
        currentUserDisplayName: profile.display_name,
        participant: {
          id: participant.id,
          displayName: participant.display_name,
          role: participantRole,
        },
        messages: messages.map((message) =>
          toClientChatMessage(
            message,
            reactions,
            userId,
            senderDisplayNames,
            (attachmentRows ?? []).filter((image) => image.message_id === message.id),
            imageUrls,
            (gifRows ?? []).find((gif) => gif.message_id === message.id)
          )
        ),
        readStates: (readStates ?? []).map(toClientChatReadState),
        participantPresence: {
          sessions: (presenceSessions ?? []).map(toClientPresenceSession),
          lastSeenAt: getLastSeenAt(presenceSessions ?? []),
        },
        searchMembers: (searchMemberProfiles ?? []).map((member) => ({
          id: member.id,
          displayName: member.display_name,
          username: member.username,
        })),
        searchChannels: (availableChannels ?? []).map((channel) => ({
          id: channel.id,
          name: channel.name,
          slug: channel.slug,
          conversationId: channel.conversation_id,
        })),
        hasMoreOlder,
        oldestCursor,
      });
    });
  }
}

function toClientChatMessage(
  row: MessageRow,
  reactions: MessageReactionRow[] = [],
  currentUserId = "",
  senderDisplayNames: Map<string, string> = new Map(),
  images: MessageAttachmentRow[] = [],
  imageUrls: Map<string, string> = new Map(),
  gif?: MessageGifRow
): ClientChatMessage {
  const reactionCounts = new Map<string, { count: number; byMe: boolean }>();

  for (const reaction of reactions) {
    if (reaction.message_id !== row.id) {
      continue;
    }

    const current = reactionCounts.get(reaction.emoji) ?? {
      count: 0,
      byMe: false,
    };
    reactionCounts.set(reaction.emoji, {
      count: current.count + 1,
      byMe: current.byMe || reaction.user_id === currentUserId,
    });
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role as ClientChatMessage["senderRole"],
    senderDisplayName: senderDisplayNames.get(row.sender_id) ?? null,
    body: row.body,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    replyToMessageId: row.reply_to_message_id,
    pinnedAt: row.pinned_at,
    pinnedBy: row.pinned_by,
    reactions: Array.from(reactionCounts.entries()).map(([emoji, reaction]) => ({
      emoji,
      count: reaction.count,
      byMe: reaction.byMe,
    })),
    gif: gif
      ? {
          provider: gif.provider as "klipy" | "giphy",
          providerId: gif.provider_content_id,
          title: gif.title,
          description: gif.description,
          sourceUrl: gif.source_url,
          posterUrl: gif.poster_url,
          previewUrl: gif.preview_url,
          mediaUrl: gif.media_url,
          width: gif.width,
          height: gif.height,
        }
      : undefined,
    images: images.flatMap((image) =>
      image.display_path && image.stored_mime_type && image.stored_byte_size
        ? [{
            id: image.id,
            status: "ready" as const,
            kind: image.kind as "image" | "file",
            originalName: image.original_name,
            mimeType: image.stored_mime_type,
            byteSize: image.stored_byte_size,
            width: image.width ?? undefined,
            height: image.height ?? undefined,
            thumbnailPath: image.thumbnail_path ?? undefined,
            displayPath: image.display_path,
            thumbnailUrl: image.thumbnail_path ? imageUrls.get(image.thumbnail_path) : undefined,
            displayUrl: imageUrls.get(image.display_path),
          }]
        : []
    ),
  };
}

function toClientChatReadState(row: MessageReadRow) {
  return {
    userId: row.user_id,
    lastDeliveredMessageId: row.last_delivered_message_id,
    deliveredAt: row.delivered_at,
    lastReadMessageId: row.last_read_message_id,
    readAt: row.read_at,
  };
}

function toClientPresenceSession(row: PresenceSessionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    activeAt: row.active_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    endedAt: row.ended_at,
  };
}

function getLastSeenAt(rows: PresenceSessionRow[]): string | null {
  let latest: string | null = null;

  for (const row of rows) {
    const ended = row.ended_at ? Date.parse(row.ended_at) : Number.NaN;
    const heartbeat = Date.parse(row.last_heartbeat_at);
    const value = Number.isNaN(ended) || ended < heartbeat
      ? row.last_heartbeat_at
      : row.ended_at ?? row.last_heartbeat_at;

    if (!latest || Date.parse(latest) < Date.parse(value)) {
      latest = value;
    }
  }

  return latest;
}
