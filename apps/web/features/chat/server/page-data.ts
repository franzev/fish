import "server-only";

import { getServerServices } from "@/lib/services/runtime/server";
import { getCurrentProfile } from "@/features/auth/server/page-data";
import type { ChatPageData } from "@/features/auth/contracts";
import { resolveAvatarUrlsSafely, type AppServices } from "@/lib/services";

export async function getChatPageData(
  injected?: AppServices
): Promise<ChatPageData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile({
    auth: services.auth,
    profiles: services.database.profiles,
  });

  if (!profile) {
    return null;
  }

  const chatResult = await services.database.chat.getAssignedConversation();
  if (!chatResult.ok) {
    throw chatResult.error;
  }

  const chat = chatResult.data;
  if (!chat) return { role: profile.role, chat: null };
  const avatarItems = await resolveAvatarUrlsSafely(services.avatars, [
    chat.participant.id,
    ...chat.messages.map((message) => message.senderId),
    ...(chat.searchMembers ?? []).map((member) => member.id),
  ]);
  const avatarUrls = new Map(avatarItems.map((item) => [item.profileId, item.url]));

  return {
    role: profile.role,
    chat: {
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
    },
  };
}
