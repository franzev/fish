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
  /** Backwards-compatible alias for `groupedWithPrevious`. */
  grouped?: boolean;
  groupedWithPrevious?: boolean;
  groupedWithNext?: boolean;
  showStatus?: boolean;
  onReactionToggle?: (emoji: string) => void;
}

/** One message row: composes the Task 1 atoms into a full message. Sent
 *  rows align to the end, received rows align to the start. Consecutive
 *  received rows reserve the avatar column until the final bubble, matching
 *  the grouped-stack pattern users expect from chat apps. */
export function Message({
  message,
  grouped = false,
  groupedWithPrevious,
  groupedWithNext = false,
  showStatus,
  onReactionToggle,
  className,
  ...props
}: MessageProps) {
  const { author, body, sentAt, mine, status, reactions, attachments, replyTo } = message;
  const isGroupedWithPrevious = groupedWithPrevious ?? grouped;
  const shouldShowAvatar = !mine && !groupedWithNext;
  const shouldShowStatus = showStatus ?? Boolean(mine && status);
  const hasReactions = Boolean(reactions?.length);
  const hasStatus = Boolean(shouldShowStatus && status);
  const hasActionRow = hasReactions || hasStatus;

  return (
    <div
      className={cn(
        "flex items-end",
        !mine && "gap-sm",
        mine ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    >
      {!mine && (
        <div className="size-8 shrink-0">
          {shouldShowAvatar && <Avatar name={author.name} src={author.avatarUrl} size="sm" />}
        </div>
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col", mine ? "items-end" : "items-start")}>
        {!isGroupedWithPrevious && <MessageMeta authorName={author.name} sentAt={sentAt} />}
        {replyTo && <QuotedMessage authorName={replyTo.authorName} snippet={replyTo.snippet} />}
        {body && (
          <Bubble
            mine={mine}
            groupedWithPrevious={isGroupedWithPrevious}
            groupedWithNext={groupedWithNext}
          >
            {body}
          </Bubble>
        )}
        <Attachments attachments={attachments} className="mt-nudge w-full max-w-message" />
        {hasActionRow && (
          <div
            className={cn(
              "mt-2xs flex items-center gap-nudge",
              mine ? "flex-row-reverse" : "flex-row"
            )}
          >
            <Reactions reactions={reactions} onToggle={onReactionToggle} />
            {hasStatus && status && <MessageStatus status={status} />}
          </div>
        )}
      </div>
    </div>
  );
}
