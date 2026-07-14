import "server-only";

import { getServerServices } from "@/lib/services/runtime/server";
import { getCurrentProfile } from "@/features/auth/server/page-data";
import type { ChatPageData } from "@/features/auth/contracts";
import {
  resolveAvatarUrlsSafely,
  type AppServices,
  type ClientChatData,
  type ClientDirectConversationPreview,
} from "@/lib/services";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveChatAvatars(
  chat: ClientChatData,
  services: AppServices
): Promise<ClientChatData> {
  const avatarItems = await resolveAvatarUrlsSafely(
    services.avatars,
    Array.from(new Set([
      chat.participant.id,
      ...chat.messages.map((message) => message.senderId),
      ...(chat.searchMembers ?? []).map((member) => member.id),
    ]))
  );
  const avatarUrls = new Map(
    avatarItems.map((item) => [item.profileId, item.url])
  );

  return {
    ...chat,
    participant: {
      ...chat.participant,
      avatarUrl: avatarUrls.get(chat.participant.id) ?? null,
    },
    messages: chat.messages.map((message) => ({
      ...message,
      senderAvatarUrl: avatarUrls.get(message.senderId) ?? null,
    })),
    searchMembers: chat.searchMembers?.map((member) => ({
      ...member,
      avatarUrl: avatarUrls.get(member.id),
    })),
  };
}

export async function getDirectConversationPreviews(
  injected?: AppServices
): Promise<ClientDirectConversationPreview[]> {
  const services = injected ?? (await getServerServices());
  const result = await services.database.chat.listDirectConversations();
  if (!result.ok) throw result.error;

  const avatarItems = await resolveAvatarUrlsSafely(
    services.avatars,
    result.data.map((preview) => preview.participant.id)
  );
  const avatarUrls = new Map(
    avatarItems.map((item) => [item.profileId, item.url])
  );
  return result.data.map((preview) => ({
    ...preview,
    participant: {
      ...preview.participant,
      avatarUrl: avatarUrls.get(preview.participant.id) ?? null,
    },
  }));
}

export async function getChatPageData(
  injected?: AppServices,
  channelSlug?: string,
  conversationId?: string,
): Promise<ChatPageData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile({
    auth: services.auth,
    profiles: services.database.profiles,
  });

  if (!profile) {
    return null;
  }

  const chatResult = await services.database.chat.getAssignedConversation(
    channelSlug,
    conversationId
  );
  if (!chatResult.ok) {
    throw chatResult.error;
  }

  const chat = chatResult.data;
  if (!chat) return { role: profile.role, chat: null };
  return {
    role: profile.role,
    chat: await resolveChatAvatars(chat, services),
  };
}

export async function getCallChatData(
  callId: string,
  injected?: AppServices
): Promise<ClientChatData | null> {
  if (!UUID_RE.test(callId)) return null;

  const services = injected ?? (await getServerServices());
  const result = await services.database.chat.getConversationForCall(callId);
  if (!result.ok) throw result.error;
  return result.data ? resolveChatAvatars(result.data, services) : null;
}
