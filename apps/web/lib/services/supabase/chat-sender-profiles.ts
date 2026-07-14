import type { MessageResponseRow } from "./chat-mapping";
import type { AppSupabaseClient } from "./types";

export async function loadSenderDisplayNames(
  client: AppSupabaseClient,
  messages: MessageResponseRow[]
): Promise<Map<string, string>> {
  const displayNames = new Map<string, string>();
  const conversationIds = Array.from(
    new Set(messages.map((message) => message.conversation_id))
  );
  const senderIds = new Set(messages.map((message) => message.sender_id));
  if (conversationIds.length === 0 || senderIds.size === 0) return displayNames;

  try {
    const { data: profiles, error } = await client.rpc(
      "list_conversation_member_profiles",
      { p_conversation_ids: conversationIds }
    );
    if (error) return displayNames;
    for (const profile of profiles ?? []) {
      if (senderIds.has(profile.id)) {
        displayNames.set(profile.id, profile.display_name);
      }
    }
  } catch {
    return displayNames;
  }

  return displayNames;
}
