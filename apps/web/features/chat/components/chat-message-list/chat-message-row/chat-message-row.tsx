import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import {
  getMessageSnippet,
  getOutgoingMessageStatus,
} from "@/features/chat/model/chat-state";
import { belongsToSameMessageGroup } from "@/features/chat/model/message-grouping";
import type { ClientChatReadState } from "@/lib/services";
import { cn } from "@/lib/utils";
import {
  IconMessageReply,
  IconMoodSmile,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import {
  Avatar,
  CommunityMessageRowLayout,
  EmojiPickerButton,
  getBubbleRadiusClasses,
  MessageBody,
  MessageMeta,
  MessageImages,
  MessageStatus,
  QuotedMessage,
  Reactions,
} from "../../visual";
import { visibleMessageBody } from "../../message-presentation";

export interface ChatMessageActions {
  reply: (message: LocalMessage) => void;
  toggleReaction: (message: LocalMessage, emoji: string) => Promise<void>;
  edit: (message: LocalMessage) => void;
  delete: (message: LocalMessage) => Promise<void>;
  retry: (
    body: string,
    clientRequestId: string,
    replyToMessageId: string | null,
    clearComposer?: boolean,
    attachmentIds?: string[],
    images?: NonNullable<LocalMessage["images"]>
  ) => Promise<void>;
}

interface ChatMessageRowProps {
  message: LocalMessage;
  previous?: LocalMessage;
  next?: LocalMessage;
  messages: LocalMessage[];
  currentUserId: string;
  isCommunity: boolean;
  participantReadState?: ClientChatReadState;
  latestMineRequestId: string | null;
  getAuthorName: (message: LocalMessage) => string;
  actions: ChatMessageActions;
}

/** Renders one transcript item and derives only row-local presentation state. */
export function ChatMessageRow({
  message,
  previous,
  next,
  messages,
  currentUserId,
  isCommunity,
  participantReadState,
  latestMineRequestId,
  getAuthorName,
  actions,
}: ChatMessageRowProps) {
  const mine = message.senderId === currentUserId;
  const groupedWithPrevious = belongsToSameMessageGroup(previous, message);
  const groupedWithNext = Boolean(
    next && belongsToSameMessageGroup(message, next)
  );
  const connectedBubbleRadius = getBubbleRadiusClasses({
    mine,
    groupedWithPrevious,
    groupedWithNext,
  });
  const compactSent =
    mine &&
    message.localStatus === "sent" &&
    message.clientRequestId === latestMineRequestId;
  const deliveryStatus = mine
    ? getOutgoingMessageStatus(message, messages, participantReadState)
    : "sent";
  const showStatus =
    mine &&
    (message.localStatus === "failed" || (compactSent && !isCommunity));
  const replyMessage = message.replyToMessageId
    ? messages.find((item) => item.id === message.replyToMessageId) ?? null
    : null;
  const startsCommunityGroup =
    isCommunity && (!groupedWithPrevious || Boolean(replyMessage));
  const showParticipantAvatar = isCommunity
    ? startsCommunityGroup
    : !mine && !groupedWithNext;
  const previousDay = previous
    ? new Date(previous.createdAt).toDateString()
    : null;
  const dayDividerLabel =
    isCommunity &&
    previousDay &&
    previousDay !== new Date(message.createdAt).toDateString()
      ? new Date(message.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
  const showMessageActions =
    message.localStatus === "sent" && !message.deletedAt;

  const rowContent = (
    <>
      {isCommunity && replyMessage && (
        <div className="relative mb-2xs flex items-center gap-2xs self-stretch text-ui-xs text-muted">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-reply-spline-left top-compact h-sm w-lg rounded-tl-chat-inner border-l border-t border-border"
          />
          <Avatar name={getAuthorName(replyMessage)} size="xs" />
          <span className="shrink-0 font-medium text-body">
            {getAuthorName(replyMessage)}
          </span>
          <span className="min-w-0 truncate">
            {getMessageSnippet(replyMessage)}
          </span>
        </div>
      )}
      {startsCommunityGroup && (
        <MessageMeta
          authorName={getAuthorName(message)}
          sentAt={message.createdAt}
          tag={message.senderRole === "coach" ? "Coach" : undefined}
        />
      )}
      {!isCommunity && replyMessage && (
        <QuotedMessage
          authorName={getAuthorName(replyMessage)}
          snippet={getMessageSnippet(replyMessage)}
        />
      )}
      {Boolean(message.images?.length) && !message.deletedAt && (
        <MessageImages images={message.images ?? []} authorName={getAuthorName(message)} mine={mine} />
      )}
      <div
        className={cn(
          "text-ui-sm break-words",
          isCommunity
            ? "text-body"
            : cn(
                "px-md py-compact",
                mine
                  ? "bg-primary text-on-primary"
                  : "bg-surface text-body",
                connectedBubbleRadius
              ),
          message.deletedAt && "italic text-muted",
          !message.deletedAt && !visibleMessageBody(message) && "hidden"
        )}
      >
        <MessageBody body={visibleMessageBody(message)} mine={mine} />
      </div>
      {message.editedAt && !message.deletedAt && (
        <p className="mt-2xs text-ui-xs text-muted">Edited</p>
      )}
      {showMessageActions && (
        <div className="pointer-events-none absolute -top-sm right-md flex items-center gap-3xs rounded-control border border-border bg-surface p-3xs opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100">
          <button
            type="button"
            aria-label="Reply to message"
            onClick={() => actions.reply(message)}
            className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
          >
            <IconMessageReply size={18} stroke={1.75} aria-hidden="true" />
          </button>
          <EmojiPickerButton
            label="Add a reaction"
            onSelect={(emoji) => void actions.toggleReaction(message, emoji)}
            className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
          >
            <IconMoodSmile size={18} stroke={1.75} aria-hidden="true" />
          </EmojiPickerButton>
          {mine && (
            <>
              <button
                type="button"
                aria-label="Edit message"
                onClick={() => actions.edit(message)}
                className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
              >
                <IconPencil size={18} stroke={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Delete message"
                onClick={() => void actions.delete(message)}
                className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-notice hover:bg-surface-2"
              >
                <IconTrash size={18} stroke={1.75} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
      <Reactions
        reactions={message.reactions}
        onToggle={(emoji) => void actions.toggleReaction(message, emoji)}
        className="mt-2xs"
      />
      <div
        className={cn(
          "flex min-h-5 items-center gap-xs text-ui-xs text-muted",
          !showStatus && "hidden",
          mine && !isCommunity ? "justify-end" : "justify-start"
        )}
      >
        {compactSent && <MessageStatus status={deliveryStatus} />}
        {mine && message.localStatus === "failed" && (
          <>
            <span>Not sent yet</span>
            <button
              type="button"
              className="min-h-control rounded-control px-xs py-2xs text-body underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() =>
                void actions.retry(
                  message.body,
                  message.clientRequestId,
                  message.replyToMessageId ?? null,
                  false,
                  message.images?.map((image) => image.id) ?? [],
                  message.images ?? []
                )
              }
            >
              Retry
            </button>
          </>
        )}
      </div>
    </>
  );

  const communityAvatarSlot = showParticipantAvatar ? (
    <Avatar
      name={getAuthorName(message)}
      size="sm"
      className={cn(replyMessage && "mt-lg")}
    />
  ) : (
    <div aria-hidden="true" className="size-8 shrink-0" />
  );

  return (
    <>
      {dayDividerLabel && (
        <li role="separator" className="mt-md flex items-center gap-xs">
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          <span
            suppressHydrationWarning
            className="text-ui-2xs font-medium text-muted"
          >
            {dayDividerLabel}
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </li>
      )}
      <li
        className={cn(
          !isCommunity && "group relative flex items-end",
          !isCommunity &&
            previous &&
            (groupedWithPrevious ? "mt-3xs" : "mt-md"),
          !isCommunity && !mine && "gap-md",
          !isCommunity && (mine ? "justify-end" : "justify-start")
        )}
      >
        {isCommunity ? (
          <CommunityMessageRowLayout
            avatarSlot={communityAvatarSlot}
            startsGroup={startsCommunityGroup}
            hasPrecedingRow={Boolean(previous)}
            interactive
          >
            {rowContent}
          </CommunityMessageRowLayout>
        ) : (
          <>
            {!mine &&
              (showParticipantAvatar ? (
                <Avatar name={getAuthorName(message)} size="sm" />
              ) : (
                <div aria-hidden="true" className="size-8 shrink-0" />
              ))}
            <div
              className={cn(
                "flex max-w-message flex-col",
                Boolean(message.images?.length) && "w-full",
                mine && "items-end"
              )}
            >
              {rowContent}
            </div>
          </>
        )}
      </li>
    </>
  );
}
