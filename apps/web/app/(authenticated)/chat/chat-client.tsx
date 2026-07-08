"use client";

import type {
  ClientChatData,
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import {
  Avatar,
  getBubbleRadiusClasses,
  MessageMeta,
  MessageStatus,
  NotificationBadge,
  QuotedMessage,
  Reactions,
  TypingIndicator,
} from "@/components/chat";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getMessageSnippet,
  getOutgoingMessageStatus,
} from "./chat-state";
import { cn } from "@/lib/utils";
import { useTimeFormatPreference } from "@/lib/prefs/time-format";
import {
  IconMicrophone,
  IconPencil,
  IconSearch,
  IconSend,
  IconThumbUp,
  IconTrash,
  IconX,
  IconMessageReply,
} from "@tabler/icons-react";
import { Fragment, useMemo, useState } from "react";
import type { SendMessageActionState } from "./actions";
import { useChatComposer } from "./hooks/use-chat-composer";
import { useChatMessages } from "./hooks/use-chat-messages";
import { useChatPresence } from "./hooks/use-chat-presence";
import { useChatReadState } from "./hooks/use-chat-read-state";
import { useChatRealtime } from "./hooks/use-chat-realtime";
import { useChatStore } from "./store/chat-store";
import {
  selectComposerForConversation,
  selectReadStatesForConversation,
  selectRealtimeStatusForConversation,
} from "./store/chat-selectors";

interface ChatClientProps {
  chat: ClientChatData;
  sendMessageAction: (input: unknown) => Promise<SendMessageActionState>;
  editMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  deleteMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  toggleReactionAction?: (input: unknown) => Promise<SendMessageActionState>;
  markReadStateAction?: (input: unknown) => Promise<{
    status: "sent" | "notice";
    values: unknown;
    notice?: string;
    readState?: ClientChatReadState;
  }>;
  refreshMessagesAction?: (input: unknown) => Promise<{
    status: "sent" | "notice";
    values: unknown;
    notice?: string;
    messages?: ClientChatMessage[];
  }>;
  refreshConversationAction?: (input: unknown) => Promise<{
    status: "sent" | "notice";
    values: unknown;
    notice?: string;
    messages?: ClientChatMessage[];
    readStates?: ClientChatReadState[];
  }>;
}

function visibleMessageBody(message: ClientChatMessage): string {
  return message.deletedAt ? "Message deleted" : message.body;
}

export function ChatClient({
  chat,
  sendMessageAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
  markReadStateAction,
  refreshMessagesAction,
  refreshConversationAction,
}: ChatClientProps) {
  useChatStore((state) => selectComposerForConversation(state, chat.conversationId));
  useChatStore((state) => selectReadStatesForConversation(state, chat.conversationId));
  useChatStore((state) =>
    selectRealtimeStatusForConversation(state, chat.conversationId)
  );
  const { messages, setMessages, refreshMessages, refreshConversation } =
    useChatMessages({
      chat,
      refreshMessagesAction,
      refreshConversationAction,
    });
  const {
    mergeReadState,
    participantReadState,
    unreadCount,
  } = useChatReadState({
    chat,
    messages,
    markReadStateAction,
  });
  const [search, setSearch] = useState("");
  const timeFormatPref = useTimeFormatPreference();
  const isCommunity = chat.kind === "community";
  const chatTitle = chat.title ?? chat.participant.displayName;
  const chatSubtitle =
    chat.subtitle ?? (chat.participant.role === "coach" ? "Coach" : "Client");
  const activityName = isCommunity ? "Someone" : chat.participant.displayName;
  const getMessageAuthorName = (message: ClientChatMessage) => {
    if (message.senderId === chat.currentUserId) {
      return "You";
    }

    return message.senderDisplayName ?? (isCommunity ? "Member" : chat.participant.displayName);
  };
  const {
    participantTyping,
    participantRecording,
    localRecording,
    sendLocalTyping,
    stopLocalTyping,
    scheduleLocalTypingStop,
    setLocalVoiceRecording,
  } = useChatRealtime({
    chat,
    setMessages,
    mergeReadState,
    refreshMessages,
    refreshConversation,
  });
  const { presenceStatus } = useChatPresence({ chat, timeFormatPref });
  const {
    draft,
    notice,
    canSend,
    replyingTo,
    editingMessage,
    handleDraftChange,
    handleSend,
    sendWithRequestId,
    handleDeleteMessage,
    handleToggleReaction,
    startReplyingToMessage,
    startEditingMessage,
    cancelReply,
    cancelEdit,
    handleComposerKeyDown,
  } = useChatComposer({
    chat,
    messages,
    sendMessageAction,
    editMessageAction,
    deleteMessageAction,
    toggleReactionAction,
    sendLocalTyping,
    stopLocalTyping,
    scheduleLocalTypingStop,
  });

  // Room membership has no dedicated table yet (demo bridge), so the member
  // count is derived from everyone the room has already seen: read states,
  // message senders, and the current user.
  const memberCount = useMemo(() => {
    const memberIds = new Set<string>([chat.currentUserId]);
    for (const readState of chat.readStates ?? []) {
      memberIds.add(readState.userId);
    }
    for (const message of messages) {
      memberIds.add(message.senderId);
    }
    return memberIds.size;
  }, [chat.currentUserId, chat.readStates, messages]);
  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return messages;
    }

    return messages.filter((message) =>
      visibleMessageBody(message).toLowerCase().includes(query)
    );
  }, [messages, search]);
  const latestMineRequestId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.senderId === chat.currentUserId) {
        return message.clientRequestId;
      }
    }

    return null;
  }, [chat.currentUserId, messages]);

  return (
    <section
      className="flex min-h-chat-container-demo w-full flex-col bg-bg"
      aria-label={isCommunity ? `${chatTitle} room` : `Conversation with ${chatTitle}`}
    >
      <header className="border-b border-border bg-surface px-md py-sm">
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0">
            <p className="text-ui text-muted">
              {chatSubtitle}
            </p>
            <h1 className="truncate font-display text-heading text-foreground">
              {chatTitle}
            </h1>
            <p className="mt-2xs flex items-center gap-nudge text-ui-sm text-muted">
              {!isCommunity && presenceStatus.showOnlineDot && (
                <span
                  aria-label="Participant is online"
                  className="size-2 rounded-pill bg-success"
                />
              )}
              <span>
                {isCommunity
                  ? `${memberCount} ${memberCount === 1 ? "member" : "members"}`
                  : presenceStatus.label}
              </span>
            </p>
          </div>
          <NotificationBadge count={unreadCount} />
        </div>
        <label className="mt-sm flex min-h-control items-center gap-xs rounded-control border border-border bg-bg px-sm text-ui-sm text-muted focus-within:border-primary">
          <IconSearch size={18} stroke={1.75} aria-hidden="true" />
          <span className="sr-only">Search messages</span>
          <input
            aria-label="Search messages"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted"
            placeholder="Search messages"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear message search"
              onClick={() => setSearch("")}
              className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
            >
              <IconX size={18} stroke={1.75} aria-hidden="true" />
            </button>
          )}
        </label>
      </header>

      <div
        role="log"
        aria-label={isCommunity ? "Community messages" : "Conversation messages"}
        className="flex-1 overflow-y-auto px-md py-md"
      >
        {filteredMessages.length === 0 && !participantTyping && !participantRecording ? (
          <div className="flex min-h-full items-center justify-center text-center text-copy text-body">
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
              const groupedWithPrevious = Boolean(
                previous && previous.senderId === message.senderId
              );
              const groupedWithNext = Boolean(next && next.senderId === message.senderId);
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
                    "group relative flex",
                    index > 0 &&
                      (groupedWithPrevious && !startsCommunityGroup
                        ? "mt-3xs"
                        : "mt-md"),
                    isCommunity
                      ? "-mx-md items-start gap-xs px-md transition-colors hover:bg-surface"
                      : cn(
                          "items-end",
                          !mine && "gap-xs",
                          mine ? "justify-end" : "justify-start"
                        )
                  )}
                >
                  {(isCommunity || !mine) &&
                    (showParticipantAvatar ? (
                      <Avatar
                        name={getMessageAuthorName(message)}
                        size="sm"
                        /* With a reply preview above, the avatar drops to sit
                           beside the author header — the preview row belongs
                           to the quoted message, not this one. */
                        className={cn(
                          isCommunity && replyMessage && "mt-lg"
                        )}
                      />
                    ) : (
                      <div aria-hidden="true" className="size-8 shrink-0" />
                    ))}
                  <div
                    className={cn(
                      "flex flex-col",
                      isCommunity
                        ? "min-w-0 flex-1 items-start"
                        : cn("max-w-message", mine && "items-end")
                    )}
                  >
                    {isCommunity && replyMessage && (
                      <div className="relative mb-2xs flex items-center gap-2xs self-stretch text-ui-xs text-muted">
                        {/* Connector spline: rises from the avatar centre in
                            the gutter and curves into the preview line. */}
                        <span
                          aria-hidden="true"
                          className="absolute -left-lg top-compact h-sm w-badge rounded-tl-chat-inner border-l border-t border-border"
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
                        authorName={
                          replyMessage.senderId === chat.currentUserId
                            ? "You"
                            : getMessageAuthorName(replyMessage)
                        }
                        snippet={getMessageSnippet(replyMessage)}
                      />
                    )}
                    <div
                      className={cn(
                        "text-copy break-words",
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
                      {visibleMessageBody(message)}
                    </div>
                    {message.editedAt && !message.deletedAt && (
                      <p className="mt-2xs text-ui-xs text-muted">Edited</p>
                    )}
                    {showMessageActions && (
                      /* Reference idiom: rows stay clean at rest; actions
                         surface in a compact bar on row hover. Revealed via
                         opacity (not display) so keyboard focus still reaches
                         the buttons, with focus-within keeping it visible. */
                      <div
                        className="pointer-events-none absolute -top-sm right-md flex items-center gap-3xs rounded-control border border-border bg-surface p-3xs opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
                      >
                        <button
                          type="button"
                          aria-label="Reply to message"
                          onClick={() => startReplyingToMessage(message)}
                          className="inline-flex size-10 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
                        >
                          <IconMessageReply size={18} stroke={1.75} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="React with thumbs up"
                          onClick={() => void handleToggleReaction(message, "👍")}
                          className="inline-flex size-10 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
                        >
                          <IconThumbUp size={18} stroke={1.75} aria-hidden="true" />
                        </button>
                        {mine && (
                          <>
                            <button
                              type="button"
                              aria-label="Edit message"
                              onClick={() => startEditingMessage(message)}
                              className="inline-flex size-10 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
                            >
                              <IconPencil size={18} stroke={1.75} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete message"
                              onClick={() => void handleDeleteMessage(message)}
                              className="inline-flex size-10 items-center justify-center rounded-control text-notice hover:bg-surface-2"
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
                  </div>
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
            {participantRecording && (
              <li className="mt-sm flex justify-start">
                <div className="rounded-control bg-surface-2 px-sm py-xs text-ui-sm text-muted">
                  {activityName} is recording audio
                </div>
              </li>
            )}
          </ol>
        )}
      </div>

      {notice && (
        <div className="border-t border-border px-md pt-sm">
          <Alert tone="notice">{notice}</Alert>
        </div>
      )}

      {(replyingTo || editingMessage || localRecording) && (
        <div className="border-t border-border bg-surface px-md py-sm">
          {replyingTo && (
            <div className="flex items-center gap-xs">
              <div className="min-w-0 flex-1">
                <p className="text-ui-xs text-muted">
                  Replying to{" "}
                  {replyingTo.senderId === chat.currentUserId
                    ? "your message"
                    : getMessageAuthorName(replyingTo)}
                </p>
                <QuotedMessage
                  authorName={
                    replyingTo.senderId === chat.currentUserId
                      ? "You"
                      : getMessageAuthorName(replyingTo)
                  }
                  snippet={getMessageSnippet(replyingTo)}
                  className="mb-0 mt-2xs"
                />
              </div>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={cancelReply}
                className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
              >
                <IconX size={18} stroke={1.75} aria-hidden="true" />
              </button>
            </div>
          )}
          {editingMessage && (
            <div className="flex items-center gap-xs text-ui-sm text-muted">
              <span className="min-w-0 flex-1">Editing message</span>
              <button
                type="button"
                aria-label="Cancel edit"
                onClick={cancelEdit}
                className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
              >
                <IconX size={18} stroke={1.75} aria-hidden="true" />
              </button>
            </div>
          )}
          {localRecording && (
            <p className="text-ui-sm text-muted">Recording audio</p>
          )}
        </div>
      )}

      <div className="flex items-end gap-xs border-t border-border bg-surface p-sm">
        <button
          type="button"
          aria-label={localRecording ? "Stop voice recording" : "Start voice recording"}
          aria-pressed={localRecording}
          onClick={() => setLocalVoiceRecording(!localRecording)}
          className={cn(
            "inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body",
            localRecording && "bg-surface-2 text-foreground"
          )}
        >
          <IconMicrophone size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <textarea
          aria-label="Message"
          value={draft}
          onChange={(event) => {
            handleDraftChange(event.target.value);
          }}
          onBlur={stopLocalTyping}
          onKeyDown={handleComposerKeyDown}
          rows={1}
          enterKeyHint="send"
          className="min-h-control flex-1 resize-none rounded-control border border-border bg-surface px-md py-field-y text-copy text-foreground placeholder:text-muted focus:border-primary"
          placeholder="Message"
        />
        <Button
          type="button"
          fullWidth={false}
          disabled={!canSend}
          onClick={() => void handleSend()}
          className="shrink-0 px-md"
          aria-label="Send message"
        >
          <IconSend size={20} stroke={1.75} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
