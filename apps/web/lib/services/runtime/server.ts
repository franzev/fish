import "server-only";

import type {
  ChatCommandService,
  ServerServices,
} from "../contracts";
import { SupabaseChatCommandService } from "../supabase/chat-command-service";
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

export async function getServerServices(): Promise<ServerServices> {
  const services = await createServerSupabaseServices();
  return {
    ...services,
    chatCommands: lazyChatCommands(),
  };
}
