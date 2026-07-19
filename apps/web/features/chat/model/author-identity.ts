import type { ClientChatData, ClientChatMessage, ClientChatSearchMember } from "@/lib/services";

export interface MessageAuthorIdentity {
  id: string;
  displayName: string;
  username?: string;
  role: ClientChatMessage["senderRole"];
  avatarUrl?: string;
}

function isCommunityChat(chat: Pick<ClientChatData, "kind" | "channelId" | "channelSlug">): boolean {
  return chat.kind === "community" || Boolean(chat.channelId ?? chat.channelSlug);
}

export function resolveMessageAuthorName(
  message: ClientChatMessage,
  chat: ClientChatData
): string {
  return message.senderDisplayName
    ?? (isCommunityChat(chat) ? "Member" : chat.participant.displayName);
}

export function resolveMessageAuthorAvatar(
  message: ClientChatMessage,
  chat: ClientChatData,
  searchMembers: ClientChatSearchMember[]
): string | undefined {
  return message.senderAvatarUrl
    ?? searchMembers.find((member) => member.id === message.senderId)?.avatarUrl
    ?? (!isCommunityChat(chat) && message.senderId === chat.participant.id
      ? chat.participant.avatarUrl ?? undefined
      : undefined);
}

export function resolveMessageAuthor(
  message: ClientChatMessage,
  chat: ClientChatData,
  searchMembers: ClientChatSearchMember[]
): MessageAuthorIdentity {
  const directoryMember = searchMembers.find((member) => member.id === message.senderId);
  return {
    id: message.senderId,
    displayName: resolveMessageAuthorName(message, chat),
    username: directoryMember?.username,
    role: message.senderRole,
    avatarUrl: resolveMessageAuthorAvatar(message, chat, searchMembers),
  };
}
