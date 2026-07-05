import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import { Attachments } from "../attachments";
import { Avatar } from "../avatar";
import { Bubble } from "../bubble";
import { MessageMeta } from "../message-meta";
import { MessageStatus } from "../message-status";
import { QuotedMessage } from "../quoted-message";
import { Reactions } from "../reactions";
import type { ChatMessageView } from "../types";

interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  message: ChatMessageView;
  /** Hide the avatar + meta row when this message is a consecutive message
   *  from the same author as the previous one (grouping). */
  grouped?: boolean;
  onReactionToggle?: (emoji: string) => void;
}

/** One message row: composes the Task 1 atoms into a full message. Sent
 *  rows align to the end, received rows align to the start. On consecutive
 *  same-author messages, the avatar + meta row collapses (grouping) but the
 *  bubble stays indented to the avatar's width so the column still lines up. */
export function Message({ message, grouped = false, onReactionToggle, className, ...props }: MessageProps) {
  const { author, body, sentAt, mine, status, reactions, attachments, replyTo } = message;

  return (
    <div
      className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row", className)}
      {...props}
    >
      <div className="w-10 shrink-0">
        {!grouped && <Avatar name={author.name} src={author.avatarUrl} size="sm" />}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col", mine ? "items-end" : "items-start")}>
        {!grouped && <MessageMeta authorName={author.name} sentAt={sentAt} />}
        {replyTo && <QuotedMessage authorName={replyTo.authorName} snippet={replyTo.snippet} />}
        {body && <Bubble mine={mine}>{body}</Bubble>}
        <Attachments attachments={attachments} className="mt-1.5 w-full max-w-message" />
        <div className={cn("mt-1 flex items-center gap-1.5", mine ? "flex-row-reverse" : "flex-row")}>
          <Reactions reactions={reactions} onToggle={onReactionToggle} />
          {mine && status && <MessageStatus status={status} />}
        </div>
      </div>
    </div>
  );
}
