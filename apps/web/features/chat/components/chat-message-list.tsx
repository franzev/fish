import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area/scroll-area";
import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import {
  getMessageSnippet,
  getOutgoingMessageStatus,
} from "@/features/chat/model/chat-state";
import { belongsToSameMessageGroup } from "@/features/chat/model/message-grouping";
import type { ClientChatData, ClientChatReadState } from "@/lib/services";
import { cn } from "@/lib/utils";
import {
  IconArrowDown,
  IconMessageReply,
  IconMoodSmile,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { Fragment, type RefObject } from "react";
import {
  Avatar,
  CommunityMessageRowLayout,
  EmojiPickerButton,
  getBubbleRadiusClasses,
  MessageBody,
  MessageMeta,
  MessageRowsSkeleton,
  MessageStatus,
  QuotedMessage,
  Reactions,
  TypingIndicator,
} from "./visual";
import { visibleMessageBody } from "./message-presentation";

interface ChatMessageListProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasMoreOlder: boolean;
  hasOlderLoadError: boolean;
  isLoadingOlder: boolean;
  loadOlderAndPreserveScroll: () => Promise<unknown>;
  filteredMessages: LocalMessage[];
  messages: LocalMessage[];
  participantTyping: boolean;
  search: string;
  isCommunity: boolean;
  activityName: string;
  chat: ClientChatData;
  participantReadState?: ClientChatReadState;
  latestMineRequestId: string | null;
  getMessageAuthorName: (message: LocalMessage) => string;
  startReplyingToMessage: (message: LocalMessage) => void;
  handleToggleReaction: (message: LocalMessage, emoji: string) => Promise<void>;
  startEditingMessage: (message: LocalMessage) => void;
  handleDeleteMessage: (message: LocalMessage) => Promise<void>;
  sendWithRequestId: (
    body: string,
    clientRequestId: string,
    replyToMessageId: string | null,
    clearComposer?: boolean
  ) => Promise<void>;
  showNewMessages: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  isReconnecting: boolean;
}

export function ChatMessageList({
  viewportRef,
  sentinelRef,
  hasMoreOlder,
  hasOlderLoadError,
  isLoadingOlder,
  loadOlderAndPreserveScroll,
  filteredMessages,
  messages,
  participantTyping,
  search,
  isCommunity,
  activityName,
  chat,
  participantReadState,
  latestMineRequestId,
  getMessageAuthorName,
  startReplyingToMessage,
  handleToggleReaction,
  startEditingMessage,
  handleDeleteMessage,
  sendWithRequestId,
  showNewMessages,
  scrollToBottom,
  isReconnecting,
}: ChatMessageListProps) {
  return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ScrollArea
          className="flex-1"
          viewportRef={viewportRef}
          viewportClassName="chat-log-viewport px-md py-md"
        >
          <div
            role="log"
            aria-busy={isLoadingOlder || undefined}
            aria-label={
              isCommunity ? "Community messages" : "Conversation messages"
            }
            className="flex min-h-full flex-col"
          >
        {hasMoreOlder && (
          <div
            ref={sentinelRef}
            aria-hidden="true"
            data-testid="load-older-sentinel"
            className="h-3xs w-full"
          />
        )}
        {(hasMoreOlder || hasOlderLoadError) && (
          <div
            data-testid="load-older-slot"
            className="flex h-pagination-slot flex-col justify-center gap-xs pb-md"
          >
            {isLoadingOlder ? (
              <>
                <MessageRowsSkeleton />
                <span role="status" className="sr-only">
                  Loading earlier messages
                </span>
              </>
            ) : hasOlderLoadError ? (
              <div
                className="flex items-center gap-xs"
                data-testid="load-older-error"
              >
                <Alert tone="notice" className="min-w-0 flex-1">
                  Couldn&apos;t load earlier messages. Try again.
                </Alert>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void loadOlderAndPreserveScroll()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              hasMoreOlder && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void loadOlderAndPreserveScroll()}
                  >
                    Load earlier messages
                  </Button>
                </div>
              )
            )}
          </div>
        )}
        {filteredMessages.length === 0 && !participantTyping ? (
          <div className="flex flex-1 items-center justify-center text-center text-copy text-body">
            {search
              ? "No messages match"
              : isCommunity
                ? "No messages yet. Say hello to the community."
                : "No messages yet."}
          </div>
        ) : (
          <ol className="flex flex-col">
            {filteredMessages.map((message, index) => {
              const mine = message.senderId === chat.currentUserId;
              const previous = filteredMessages[index - 1];
              const next = filteredMessages[index + 1];
              // Same sender alone used to group a run indefinitely (WR-02):
              // the shared predicate also requires the same calendar day and
              // a short gap, so identity/time reappear on a long run.
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
                (message.localStatus === "failed" ||
                  (compactSent && !isCommunity));
              const replyMessage = message.replyToMessageId
                ? messages.find((item) => item.id === message.replyToMessageId) ??
                  null
                : null;
              // Community rows read top-down like a feed: author meta and
              // avatar sit at the start of a group, and a reply always
              // restates its author so quoted context reads in place. Direct
              // chat keeps the messenger idiom: avatar at the end of the
              // partner's group.
              const startsCommunityGroup =
                isCommunity && (!groupedWithPrevious || Boolean(replyMessage));
              const showParticipantAvatar = isCommunity
                ? startsCommunityGroup
                : !mine && !groupedWithNext;
              const showAuthorMeta = startsCommunityGroup;
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
                        {/* L-connector: stem on avatar centre, arm into preview row. */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -left-reply-spline-left top-compact h-sm w-lg rounded-tl-chat-inner border-l border-t border-border"
                        />
                        <Avatar
                          name={getMessageAuthorName(replyMessage)}
                          size="xs"
                        />
                        <span className="shrink-0 font-medium text-body">
                          {getMessageAuthorName(replyMessage)}
                        </span>
                        <span className="min-w-0 truncate">
                          {getMessageSnippet(replyMessage)}
                        </span>
                      </div>
                    )}
                    {showAuthorMeta && (
                      <MessageMeta
                        authorName={getMessageAuthorName(message)}
                        sentAt={message.createdAt}
                        tag={
                          message.senderRole === "coach" ? "Coach" : undefined
                        }
                      />
                    )}
                    {!isCommunity && replyMessage && (
                      <QuotedMessage
                        authorName={getMessageAuthorName(replyMessage)}
                        snippet={getMessageSnippet(replyMessage)}
                      />
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
                        message.deletedAt && "italic text-muted"
                      )}
                    >
                      <MessageBody body={visibleMessageBody(message)} mine={mine} />
                    </div>
                    {message.editedAt && !message.deletedAt && (
                      <p className="mt-2xs text-ui-xs text-muted">Edited</p>
                    )}
                    {showMessageActions && (
                      /* Reference idiom: rows stay clean at rest; actions
                         surface in a compact bar on row hover. Revealed via
                         opacity (not display) so keyboard focus still reaches
                         the buttons, with focus-within keeping it visible.
                         pointer-coarse also reveals it unconditionally (WR-04):
                         touch/coarse pointers have no hover, so the bar must
                         not depend on it to be reachable. Each control is
                         min-h-control/min-w-control (56px) — the compact
                         hover-only 40px bar violated the non-negotiable
                         tap-target floor. */
                      <div
                        className="pointer-events-none absolute -top-sm right-md flex items-center gap-3xs rounded-control border border-border bg-surface p-3xs opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100"
                      >
                        <button
                          type="button"
                          aria-label="Reply to message"
                          onClick={() => startReplyingToMessage(message)}
                          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
                        >
                          <IconMessageReply size={18} stroke={1.75} aria-hidden="true" />
                        </button>
                        <EmojiPickerButton
                          label="Add a reaction"
                          onSelect={(emoji) => void handleToggleReaction(message, emoji)}
                          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
                        >
                          <IconMoodSmile size={18} stroke={1.75} aria-hidden="true" />
                        </EmojiPickerButton>
                        {mine && (
                          <>
                            <button
                              type="button"
                              aria-label="Edit message"
                              onClick={() => startEditingMessage(message)}
                              className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
                            >
                              <IconPencil size={18} stroke={1.75} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete message"
                              onClick={() => void handleDeleteMessage(message)}
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
                      onToggle={(emoji) => void handleToggleReaction(message, emoji)}
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
                              void sendWithRequestId(
                                message.body,
                                message.clientRequestId,
                                message.replyToMessageId ?? null,
                                false
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
                  name={getMessageAuthorName(message)}
                  size="sm"
                  /* With a reply preview above, the avatar drops to sit
                     beside the author header — the preview row belongs
                     to the quoted message, not this one. */
                  className={cn(replyMessage && "mt-lg")}
                />
              ) : (
                <div aria-hidden="true" className="size-8 shrink-0" />
              );

              return (
                <Fragment key={message.clientRequestId}>
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
                      index > 0 &&
                      (groupedWithPrevious ? "mt-3xs" : "mt-md"),
                    !isCommunity && !mine && "gap-md",
                    !isCommunity && (mine ? "justify-end" : "justify-start")
                  )}
                >
                  {isCommunity ? (
                    <CommunityMessageRowLayout
                      avatarSlot={communityAvatarSlot}
                      startsGroup={startsCommunityGroup}
                      hasPrecedingRow={index > 0}
                      interactive
                    >
                      {rowContent}
                    </CommunityMessageRowLayout>
                  ) : (
                    <>
                      {!mine &&
                        (showParticipantAvatar ? (
                          <Avatar
                            name={getMessageAuthorName(message)}
                            size="sm"
                          />
                        ) : (
                          <div aria-hidden="true" className="size-8 shrink-0" />
                        ))}
                      <div
                        className={cn(
                          "flex max-w-message flex-col",
                          mine && "items-end"
                        )}
                      >
                        {rowContent}
                      </div>
                    </>
                  )}
                </li>
                </Fragment>
              );
            })}
            {participantTyping && (
              <li className="mt-sm flex justify-start">
                <div className="flex items-center gap-xs text-ui-sm text-muted">
                  <TypingIndicator aria-label={`${activityName} is typing`} />
                  <span>{activityName} is typing</span>
                </div>
              </li>
            )}
          </ol>
        )}
          </div>
        </ScrollArea>
        {showNewMessages && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute inset-x-0 bottom-sm mx-auto inline-flex min-h-control w-fit items-center gap-2xs rounded-pill border border-border bg-surface px-md text-ui-sm text-body shadow-popover hover:bg-surface-2"
          >
            <IconArrowDown size={18} stroke={1.75} aria-hidden="true" />
            New messages
          </button>
        )}
        {!showNewMessages && isReconnecting && (
          <div
            role="status"
            className="absolute inset-x-0 bottom-sm mx-auto inline-flex min-h-control w-fit items-center gap-2xs rounded-pill border border-border bg-surface px-md text-ui-sm text-muted shadow-popover"
          >
            Reconnecting…
          </div>
        )}
      </div>
  );
}
