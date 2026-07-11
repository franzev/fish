import type { ClientChatMessage } from "@/lib/services";

export function visibleMessageBody(message: ClientChatMessage): string {
  return message.deletedAt ? "Message deleted" : message.body;
}
