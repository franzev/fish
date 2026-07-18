import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import { Avatar } from "@/features/chat/components/avatar";
import { MessageBody } from "@/features/chat/components/message-body";
import { MessageImages } from "@/features/chat/components/message-images";
import { MessageMeta } from "@/features/chat/components/message-meta";
import { visibleMessageBody } from "@/features/chat/components/message-presentation";

interface SearchResultCardProps {
  message: LocalMessage;
  currentUserId: string;
  authorName: string;
  avatarUrl?: string;
}

export function SearchResultCard({ message, currentUserId, authorName, avatarUrl }: SearchResultCardProps) {
  const mine = message.senderId === currentUserId;
  const attachments = message.attachments ?? message.images ?? [];
  return (
    <article className="flex gap-sm rounded-card bg-surface-2 p-sm">
      <Avatar size="md" name={authorName} src={avatarUrl} />
      <div className="min-w-0 flex-1">
        <MessageMeta authorName={authorName} sentAt={message.createdAt} tag={message.senderRole === "coach" ? "Coach" : undefined} />
        {/* Same size the chat bubble wrapper applies — the renderer inherits. */}
        <MessageBody body={visibleMessageBody(message)} className="text-ui-sm" />
        {attachments.length > 0 && <div className="mt-xs"><MessageImages images={attachments} authorName={authorName} mine={mine} /></div>}
      </div>
    </article>
  );
}
