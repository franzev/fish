import type { ClientChatData, FriendProfile } from "@/lib/services";

export function getDirectFriendProfile(
  chat: ClientChatData
): FriendProfile | null {
  if (
    chat.kind !== "direct" ||
    chat.currentUserRole !== "client" ||
    chat.participant.role !== "client"
  ) {
    return null;
  }

  const participant = chat.searchMembers?.find(
    (member) => member.id === chat.participant.id
  );
  if (!participant?.username) return null;

  return {
    id: chat.participant.id,
    displayName: chat.participant.displayName,
    username: participant.username,
    avatarUrl: chat.participant.avatarUrl,
  };
}
