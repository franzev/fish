import "server-only";

import type { AppServices, CommandTransportService } from "../contracts";
import { createServerSupabaseServices } from "../supabase/server";
export * from "../supabase/local-chat-commands";
import { isLocalBackendUnavailable, postBackendCommand } from "../supabase/edge-function-transport";

const commandTransport: CommandTransportService = {
  post: postBackendCommand,
  isLocallyUnavailable: isLocalBackendUnavailable,
};

export async function getServerServices(overrides?: AppServices): Promise<AppServices> {
  return overrides ?? createServerSupabaseServices();
}

export function getCommandTransport(override?: CommandTransportService): CommandTransportService {
  return override ?? commandTransport;
}
