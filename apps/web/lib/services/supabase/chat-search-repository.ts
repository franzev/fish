import type {
  ChatOperationResult,
  ChatSearchInput,
  ChatSearchRepository,
  ChatSearchResult,
} from "../contracts";
import { mapChatErrorNotice, type MessageResponseRow } from "./chat-mapping";
import { hydrateClientChatMessages } from "./chat-message-hydration";
import type { AppSupabaseClient } from "./types";

const searchNotice =
  "Search is taking a little longer. Check your connection and try again.";

export class SupabaseChatSearchRepository implements ChatSearchRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async search(
    input: ChatSearchInput
  ): Promise<ChatOperationResult<ChatSearchResult>> {
    const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
    const rpcInput = {
      p_conversation_id: input.conversationId,
      p_query: input.text,
      p_sender_ids: input.senderIds,
      p_mentioned_user_ids: input.mentionedUserIds,
      p_channel_ids: input.channelIds,
      p_content_kinds: input.contentKinds,
      p_author_types: input.authorTypes,
      p_dates: input.dates,
      p_limit: limit,
      p_offset: input.offset ?? 0,
      p_sort_direction: input.sortDirection ?? "desc",
      ...(input.pinned === null ? {} : { p_pinned: input.pinned }),
      ...(input.cursor
        ? {
            p_before_created_at: input.cursor.createdAt,
            p_before_id: input.cursor.id,
          }
        : {}),
    };
    const [{ data, error }, countResult] = await Promise.all([
      this.client.rpc("search_chat_messages", rpcInput),
      this.client.rpc("count_chat_messages", {
        p_conversation_id: input.conversationId,
        p_query: input.text,
        p_sender_ids: input.senderIds,
        p_mentioned_user_ids: input.mentionedUserIds,
        p_channel_ids: input.channelIds,
        p_content_kinds: input.contentKinds,
        p_author_types: input.authorTypes,
        p_dates: input.dates,
        ...(input.pinned === null ? {} : { p_pinned: input.pinned }),
      }),
    ]);

    if (error || !data || countResult.error || countResult.data === null) {
      return {
        ok: false,
        notice: mapChatErrorNotice(error ?? countResult.error, searchNotice),
      };
    }

    const rows = data as MessageResponseRow[];
    const messages = await hydrateClientChatMessages(this.client, rows);
    const last = rows.at(-1);

    return {
      ok: true,
      data: {
        messages,
        totalCount: Number(countResult.data),
        nextCursor:
          rows.length === limit && last
            ? { createdAt: last.created_at, id: last.id }
            : null,
      },
    };
  }
}
