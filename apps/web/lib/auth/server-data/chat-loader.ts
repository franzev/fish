import "server-only";

import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import { getCurrentProfile } from "./profile-loaders";
import type { ChatPageData } from "./types";

export async function getChatPageData(): Promise<ChatPageData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

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
