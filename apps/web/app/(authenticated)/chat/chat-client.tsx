"use client";

import type {
  ClientChatData,
  ClientChatMessage,
  ClientChatPresenceSession,
  ClientChatReadState,
} from "@/lib/services";
import {
  Avatar,
  getBubbleRadiusClasses,
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
import {
  derivePresenceSnapshot,
  formatPresenceStatus,
} from "./presence";
import { useTimeFormatPreference } from "@/lib/prefs/time-format";
import { chatLimits } from "@fish/core/chat";
import {
  IconMicrophone,
  IconPencil,
  IconSearch,
  IconSend,
  IconTrash,
  IconX,
  IconMessageReply,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SendMessageActionState } from "./actions";
import {
  type LocalMessage,
  mergeMessage,
  useChatMessages,
} from "./hooks/use-chat-messages";
import { useChatReadState } from "./hooks/use-chat-read-state";
import {
  type ConversationVoiceRecordingSubscription,
  type ConversationTypingSubscription,
  subscribeToConversationMessages,
  subscribeToConversationReadStates,
  subscribeToConversationReactionChanges,
  subscribeToConversationVoiceRecording,
  subscribeToParticipantPresence,
  subscribeToConversationTyping,
  startPresenceSession,
} from "./realtime";

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

function makeRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}`;
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
  const refreshedReadStatesRef = useRef<(readStates: ClientChatReadState[]) => void>(
    () => undefined
  );
  const { messages, setMessages, refreshMessages, refreshConversation } =
    useChatMessages({
      chat,
      refreshMessagesAction,
      refreshConversationAction,
      onReadStatesRefreshed(readStates) {
        refreshedReadStatesRef.current(readStates);
      },
    });
  const {
    mergeReadState,
    mergeReadStates,
    participantReadState,
    unreadCount,
  } = useChatReadState({
    chat,
    messages,
    markReadStateAction,
  });
  refreshedReadStatesRef.current = mergeReadStates;
  const [participantPresenceSessions, setParticipantPresenceSessions] = useState<
    ClientChatPresenceSession[]
  >(() => chat.participantPresence?.sessions ?? []);
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [participantTyping, setParticipantTyping] = useState(false);
  const [participantRecording, setParticipantRecording] = useState(false);
  const [localRecording, setLocalRecording] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const typingSubscriptionRef = useRef<ConversationTypingSubscription | null>(null);
  const voiceSubscriptionRef =
    useRef<ConversationVoiceRecordingSubscription | null>(null);
  const localTypingRef = useRef(false);
  const localTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantRecordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeFormatPref = useTimeFormatPreference();

  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length > 0;
  const participantPresence = derivePresenceSnapshot(
    participantPresenceSessions,
    now
  );
  const presenceStatus = formatPresenceStatus(
    {
      ...participantPresence,
      lastSeenAt:
        participantPresence.lastSeenAt ?? chat.participantPresence?.lastSeenAt ?? null,
    },
    now,
    timeFormatPref
  );
  const replyingTo = replyingToId
    ? messages.find((message) => message.id === replyingToId) ?? null
    : null;
  const editingMessage = editingMessageId
    ? messages.find((message) => message.id === editingMessageId) ?? null
    : null;
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

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const presence = startPresenceSession(chat.currentUserId);

    return () => {
      presence.stop();
    };
  }, [chat.currentUserId]);

  useEffect(() => {
    return subscribeToConversationMessages(
      chat.conversationId,
      (message) => {
        setMessages((current) => mergeMessage(current, message));
      },
      () => {
        void refreshConversation();
      }
    );
  }, [chat.conversationId, refreshConversation]);

  useEffect(() => {
    return subscribeToConversationReadStates(
      chat.conversationId,
      (readState) => {
        mergeReadState(readState);
      },
      () => {
        void refreshConversation();
      }
    );
  }, [chat.conversationId, mergeReadState, refreshConversation]);

  useEffect(() => {
    return subscribeToConversationReactionChanges(
      chat.conversationId,
      (messageId) => {
        void refreshMessages([messageId]);
      },
      () => {
        void refreshConversation();
      }
    );
  }, [chat.conversationId, refreshConversation, refreshMessages]);

  useEffect(() => {
    return subscribeToParticipantPresence(chat.participant.id, (session, eventType) => {
      setParticipantPresenceSessions((current) => {
        if (eventType === "DELETE") {
          return current.filter((item) => item.id !== session.id);
        }

        const existingIndex = current.findIndex((item) => item.id === session.id);
        if (existingIndex === -1) {
          return [...current, session];
        }

        const next = [...current];
        next[existingIndex] = session;
        return next;
      });
      setNow(new Date());
    });
  }, [chat.participant.id]);

  useEffect(() => {
    const subscription = subscribeToConversationTyping(
      chat.conversationId,
      chat.currentUserId,
      (typing) => {
        setParticipantTyping(typing);

        if (participantTypingTimeoutRef.current) {
          clearTimeout(participantTypingTimeoutRef.current);
        }

        if (typing) {
          participantTypingTimeoutRef.current = setTimeout(() => {
            setParticipantTyping(false);
          }, 4000);
        }
      }
    );

    typingSubscriptionRef.current = subscription;

    return () => {
      typingSubscriptionRef.current = null;
      subscription.unsubscribe();

      if (localTypingTimeoutRef.current) {
        clearTimeout(localTypingTimeoutRef.current);
      }

      if (participantTypingTimeoutRef.current) {
        clearTimeout(participantTypingTimeoutRef.current);
      }
    };
  }, [chat.conversationId, chat.currentUserId]);

  useEffect(() => {
    const subscription = subscribeToConversationVoiceRecording(
      chat.conversationId,
      chat.currentUserId,
      (recording) => {
        setParticipantRecording(recording);

        if (participantRecordingTimeoutRef.current) {
          clearTimeout(participantRecordingTimeoutRef.current);
        }

        if (recording) {
          participantRecordingTimeoutRef.current = setTimeout(() => {
            setParticipantRecording(false);
          }, 5000);
        }
      }
    );

    voiceSubscriptionRef.current = subscription;

    return () => {
      voiceSubscriptionRef.current = null;
      subscription.unsubscribe();

      if (participantRecordingTimeoutRef.current) {
        clearTimeout(participantRecordingTimeoutRef.current);
      }
    };
  }, [chat.conversationId, chat.currentUserId]);

  function sendLocalTyping(typing: boolean) {
    if (localTypingRef.current === typing) {
      return;
    }

    localTypingRef.current = typing;
    typingSubscriptionRef.current?.sendTyping(typing);
  }

  function stopLocalTyping() {
    if (localTypingTimeoutRef.current) {
      clearTimeout(localTypingTimeoutRef.current);
      localTypingTimeoutRef.current = null;
    }

    sendLocalTyping(false);
  }

  function setLocalVoiceRecording(recording: boolean) {
    setLocalRecording(recording);
    voiceSubscriptionRef.current?.sendRecording(recording);
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    setNotice(null);

    if (value.trim().length === 0) {
      stopLocalTyping();
      return;
    }

    sendLocalTyping(true);

    if (localTypingTimeoutRef.current) {
      clearTimeout(localTypingTimeoutRef.current);
    }

    localTypingTimeoutRef.current = setTimeout(() => {
      sendLocalTyping(false);
      localTypingTimeoutRef.current = null;
    }, 3000);
  }

  async function sendWithRequestId(
    body: string,
    clientRequestId: string,
    replyToMessageId: string | null,
    clearComposer = false
  ) {
    setNotice(null);
    stopLocalTyping();

    const optimistic: LocalMessage = {
      id: clientRequestId,
      conversationId: chat.conversationId,
      senderId: chat.currentUserId,
      senderRole: chat.currentUserRole,
      body,
      clientRequestId,
      editedAt: null,
      deletedAt: null,
      replyToMessageId,
      reactions: [],
      createdAt: new Date().toISOString(),
      localStatus: "pending",
    };

    setMessages((current) => {
      const exists = current.some(
        (message) => message.clientRequestId === clientRequestId
      );
      return exists
        ? current.map((message) =>
            message.clientRequestId === clientRequestId ? optimistic : message
          )
        : [...current, optimistic];
    });

    if (clearComposer) {
      setDraft("");
      setReplyingToId(null);
    }

    const result = await sendMessageAction({
      conversationId: chat.conversationId,
      body,
      clientRequestId,
      replyToMessageId,
    }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That did not send yet. Keep this open and try again.",
    }));

    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That did not send yet. Keep this open and try again.");
      setMessages((current) =>
        current.map((message) =>
          message.clientRequestId === clientRequestId
            ? { ...message, localStatus: "failed" }
            : message
        )
      );
      return;
    }

    const sentMessage = result.message;
    setMessages((current) =>
      mergeMessage(current, sentMessage, clientRequestId)
    );
  }

  async function handleEditMessage(body: string) {
    if (!editingMessageId || !editMessageAction) {
      return;
    }

    setNotice(null);
    const result = await editMessageAction({
      messageId: editingMessageId,
      body,
    }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That did not save yet. Keep this open and try again.",
    }));

    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That did not save yet. Keep this open and try again.");
      return;
    }

    setMessages((current) => mergeMessage(current, result.message!));
    setDraft("");
    setEditingMessageId(null);
  }

  async function handleSend() {
    if (trimmedDraft.length === 0) {
      setNotice("Add a message before sending.");
      return;
    }

    if (trimmedDraft.length > chatLimits.messageBodyMaxLength) {
      setNotice("This message is a little long. Try sending it in two parts.");
      return;
    }

    if (editingMessageId) {
      await handleEditMessage(trimmedDraft);
      return;
    }

    await sendWithRequestId(trimmedDraft, makeRequestId(), replyingToId, true);
  }

  async function handleDeleteMessage(message: LocalMessage) {
    if (!deleteMessageAction) {
      setNotice("That action is not available yet.");
      return;
    }

    const result = await deleteMessageAction({ messageId: message.id }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That did not delete yet. Keep this open and try again.",
    }));
    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That did not delete yet. Keep this open and try again.");
      return;
    }

    setMessages((current) => mergeMessage(current, result.message!));
  }

  async function handleToggleReaction(message: LocalMessage, emoji: string) {
    if (!toggleReactionAction) {
      setNotice("That reaction did not save yet. Keep this open and try again.");
      return;
    }

    const result = await toggleReactionAction({
      messageId: message.id,
      emoji,
    }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That reaction did not save yet. Keep this open and try again.",
    }));

    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That reaction did not save yet. Keep this open and try again.");
      return;
    }

    setMessages((current) => mergeMessage(current, result.message!));
  }

  function startEditingMessage(message: LocalMessage) {
    setEditingMessageId(message.id);
    setReplyingToId(null);
    setDraft(message.body);
    setNotice(null);
  }

  return (
    <section
      className="mx-auto flex min-h-chat-container-demo w-full max-w-chat flex-col overflow-hidden rounded-card border border-border bg-bg"
      aria-label={`Conversation with ${chat.participant.displayName}`}
    >
      <header className="border-b border-border bg-surface px-md py-sm">
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0">
            <p className="text-ui text-muted">
              {chat.participant.role === "coach" ? "Coach" : "Client"}
            </p>
            <h1 className="truncate font-display text-heading text-foreground">
              {chat.participant.displayName}
            </h1>
            <p className="mt-2xs flex items-center gap-nudge text-ui-sm text-muted">
              {presenceStatus.showOnlineDot && (
                <span
                  aria-label="Participant is online"
                  className="size-2 rounded-pill bg-success"
                />
              )}
              <span>{presenceStatus.label}</span>
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
        aria-label="Conversation messages"
        className="flex-1 overflow-y-auto px-md py-md"
      >
        {filteredMessages.length === 0 && !participantTyping && !participantRecording ? (
          <div className="flex min-h-full items-center justify-center text-center text-copy text-body">
            {search ? "No messages match" : "No messages yet."}
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
                (message.localStatus === "failed" || compactSent);
              const showParticipantAvatar = !mine && !groupedWithNext;
              const showMessageActions =
                message.localStatus === "sent" && !message.deletedAt;

              return (
                <li
                  key={message.clientRequestId}
                  className={cn(
                    "flex items-end",
                    index > 0 && (groupedWithPrevious ? "mt-3xs" : "mt-md"),
                    !mine && "gap-xs",
                    mine ? "justify-end" : "justify-start"
                  )}
                >
                  {!mine &&
                    (showParticipantAvatar ? (
                      <Avatar name={chat.participant.displayName} size="sm" />
                    ) : (
                      <div aria-hidden="true" className="size-8 shrink-0" />
                    ))}
                  <div className={cn("flex max-w-message flex-col", mine && "items-end")}>
                    {message.replyToMessageId &&
                      (() => {
                        const reply = messages.find(
                          (item) => item.id === message.replyToMessageId
                        );
                        return reply ? (
                          <QuotedMessage
                            authorName={
                              reply.senderId === chat.currentUserId
                                ? "You"
                                : chat.participant.displayName
                            }
                            snippet={getMessageSnippet(reply)}
                          />
                        ) : null;
                      })()}
                    <div
                      className={cn(
                        "px-md py-compact text-copy break-words",
                        mine
                          ? "bg-primary text-on-primary"
                          : "bg-surface text-body",
                        message.deletedAt && "italic text-muted",
                        connectedBubbleRadius
                      )}
                    >
                      {visibleMessageBody(message)}
                    </div>
                    {message.editedAt && !message.deletedAt && (
                      <p className="mt-2xs text-ui-xs text-muted">Edited</p>
                    )}
                    {showMessageActions && (
                      <div
                        className={cn(
                          "mt-2xs flex flex-wrap items-center gap-2xs",
                          mine ? "justify-end" : "justify-start"
                        )}
                      >
                        <button
                          type="button"
                          aria-label="Reply to message"
                          onClick={() => {
                            setReplyingToId(message.id);
                            setEditingMessageId(null);
                            setNotice(null);
                          }}
                          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
                        >
                          <IconMessageReply size={18} stroke={1.75} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="React with thumbs up"
                          onClick={() => void handleToggleReaction(message, "👍")}
                          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
                        >
                          <span aria-hidden="true">👍</span>
                        </button>
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
                        mine ? "justify-end" : "justify-start"
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
              );
            })}
            {participantTyping && (
              <li className="mt-sm flex justify-start">
                <div className="flex items-center gap-xs text-ui-sm text-muted">
                  <TypingIndicator aria-label={`${chat.participant.displayName} is typing`} />
                  <span>{chat.participant.displayName} is typing</span>
                </div>
              </li>
            )}
            {participantRecording && (
              <li className="mt-sm flex justify-start">
                <div className="rounded-control bg-surface-2 px-sm py-xs text-ui-sm text-muted">
                  {chat.participant.displayName} is recording audio
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
                    : chat.participant.displayName}
                </p>
                <QuotedMessage
                  authorName={
                    replyingTo.senderId === chat.currentUserId
                      ? "You"
                      : chat.participant.displayName
                  }
                  snippet={getMessageSnippet(replyingTo)}
                  className="mb-0 mt-2xs"
                />
              </div>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={() => setReplyingToId(null)}
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
                onClick={() => {
                  setEditingMessageId(null);
                  setDraft("");
                }}
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
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) {
              return;
            }

            event.preventDefault();
            void handleSend();
          }}
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
