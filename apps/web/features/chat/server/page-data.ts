import "server-only";

import { getServerServices } from "@/lib/services/runtime/server";
import { getCurrentProfile } from "@/features/auth/server/page-data";
import type { ChatPageData } from "@/features/auth/contracts";
import type { AppServices } from "@/lib/services";

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

  return {
    role: profile.role,
    chat: chatResult.data,
  };
}
