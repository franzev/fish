import "server-only";

import type { AppServices } from "../contracts";
import { createServerSupabaseServices } from "../supabase/server";
export {
  backfillMessagesViaLocalRpc,
  commandMessageViaLocalRpc,
  loadNewestMessagesViaLocalRpc,
  loadOlderMessagesViaLocalRpc,
  markReadStateViaLocalRpc,
  refreshConversationViaLocalRpc,
  refreshMessagesViaLocalRpc,
  sendMessageViaLocalRpc,
  toClientChatMessagesWithSenders,
} from "../supabase/local-chat-commands";
export { postBackendCommand, isLocalBackendUnavailable } from "../supabase/edge-function-transport";

export async function getServerServices(overrides?: AppServices): Promise<AppServices> {
  return overrides ?? createServerSupabaseServices();
}
