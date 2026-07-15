import "server-only";

import { isSentryEnabled } from "@/lib/observability/environment";
import { observeServiceTree } from "@/lib/observability/service-observer";
import type {
  BookingCommandService,
  ChatCommandService,
  ServerServices,
} from "../contracts";
import { SupabaseChatCommandService } from "../supabase/chat-command-service";
import { SupabaseBookingCommandService } from "../supabase/booking-command-service";
import {
  createServerSupabaseClient,
  createServerSupabaseServices,
} from "../supabase/server";

function lazyChatCommands(): ChatCommandService {
  async function adapter() {
    return new SupabaseChatCommandService(await createServerSupabaseClient());
  }

  return {
    sendMessage: async (input) => (await adapter()).sendMessage(input),
    executeMessageCommand: async (command) =>
      (await adapter()).executeMessageCommand(command),
    reportGif: async (input) => (await adapter()).reportGif(input),
    markReadState: async (input) => (await adapter()).markReadState(input),
    refreshMessages: async (input) => (await adapter()).refreshMessages(input),
    refreshConversation: async (input) =>
      (await adapter()).refreshConversation(input),
    loadOlderMessages: async (input) =>
      (await adapter()).loadOlderMessages(input),
    backfillMessages: async (input) =>
      (await adapter()).backfillMessages(input),
    loadNewestMessages: async (input) =>
      (await adapter()).loadNewestMessages(input),
  };
}

function lazyBookingCommands(): BookingCommandService {
  async function adapter() {
    return new SupabaseBookingCommandService(await createServerSupabaseClient());
  }

  return {
    bookSlot: async (slotId) => (await adapter()).bookSlot(slotId),
  };
}

export async function getServerServices(): Promise<ServerServices> {
  const services = await createServerSupabaseServices();
  const serverServices: ServerServices = {
    ...services,
    chatCommands: lazyChatCommands(),
    bookingCommands: lazyBookingCommands(),
  };
  return isSentryEnabled()
    ? observeServiceTree(serverServices, {
        prefix: "services.server",
        runtime: "server",
      })
    : serverServices;
}
