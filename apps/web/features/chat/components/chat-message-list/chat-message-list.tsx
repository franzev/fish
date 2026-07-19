import { ScrollArea } from "@/components/ui/scroll-area";
import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import type {
  ClientChatData,
  ClientChatReadState,
  ClientChatUnreadSummary,
} from "@/lib/services";
import { IconArrowDown } from "@tabler/icons-react";
import { useMemo, type RefObject } from "react";
import type { CommunityMemberProfile } from "../member-profile-popover";
import { TypingIndicator } from "../visual";
import {
  ChatMessageRow,
} from "./chat-message-row";
import type { MessageActionResult } from "./message-actions";
import type { SendWithRequestIdOptions } from "@/features/chat/hooks/use-send-message";
import { OlderMessagesControl } from "./older-messages-control";
import { findFirstUnreadMessageId } from "./first-unread";

export interface ChatMessageActions {
  canDelete: boolean;
  reply: (message: LocalMessage) => void;
  toggleReaction: (message: LocalMessage, emoji: string) => Promise<void>;
  isReactionPending?: (messageId: string) => boolean;
  delete: (message: LocalMessage) => Promise<MessageActionResult>;
  reportGif: (message: LocalMessage) => Promise<void>;
  retry: (options: SendWithRequestIdOptions) => Promise<void>;
}

export interface ChatMessageEditingState {
  enabled: boolean;
  messageId: string | null;
  draft: string;
  notice: string | null;
  saving: boolean;
  start: (message: LocalMessage) => void;
  change: (value: string) => void;
  save: () => void;
  cancel: () => void;
}

interface ChatMessageListProps {
  viewport: {
    ref: RefObject<HTMLDivElement | null>;
    showNewMessages: boolean;
    scrollToBottom: (behavior?: ScrollBehavior) => void;
    isReconnecting: boolean;
  };
  pagination: {
    sentinelRef: RefObject<HTMLDivElement | null>;
    hasMore: boolean;
    hasError: boolean;
    loading: boolean;
    load: () => Promise<unknown>;
  };
  transcript: {
    visibleMessages: LocalMessage[];
    allMessages: LocalMessage[];
    participantTyping: boolean;
    isCommunity: boolean;
    activityName: string;
    chat: ClientChatData;
    participantReadState?: ClientChatReadState;
    latestMineRequestId: string | null;
    unreadBoundary: ClientChatUnreadSummary;
    friendActionsEnabled: boolean;
    focusMessageId?: string | null;
    getAuthorName: (message: LocalMessage) => string;
    getAuthorAvatar: (message: LocalMessage) => string | null | undefined;
    getAuthorMember: (message: LocalMessage) => CommunityMemberProfile;
  };
  actions: ChatMessageActions;
  editing: ChatMessageEditingState;
}

/** Coordinates transcript scrolling and delegates pagination and row details
 * to focused private components. */
export function ChatMessageList({
  viewport,
  pagination,
  transcript,
  actions,
  editing,
}: ChatMessageListProps) {
  const {
    visibleMessages,
    allMessages,
    participantTyping,
    isCommunity,
    activityName,
    chat,
    participantReadState,
    latestMineRequestId,
    unreadBoundary,
    friendActionsEnabled,
    focusMessageId,
    getAuthorName,
    getAuthorAvatar,
    getAuthorMember,
  } = transcript;
  const emptyMessage = isCommunity
    ? "No messages yet. Say hello to the community."
    : "No messages yet.";
  const oldestUnreadAt = unreadBoundary.oldestUnreadAt;
  const firstLoadedUnreadMessageId = findFirstUnreadMessageId(
    visibleMessages,
    { count: unreadBoundary.count, oldestUnreadAt },
    chat.currentUserId
  );
  const replyMessages = useMemo(
    () => new Map(allMessages.map((message) => [message.id, message] as const)),
    [allMessages]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ScrollArea
        className="flex-1"
        viewportRef={viewport.ref}
        viewportClassName="chat-log-viewport px-md py-md"
      >
        <div
          role="log"
          aria-busy={pagination.loading || undefined}
          aria-label={
            isCommunity ? "Community messages" : "Conversation messages"
          }
          className="flex min-h-full flex-col"
        >
          <OlderMessagesControl
            sentinelRef={pagination.sentinelRef}
            hasMore={pagination.hasMore}
            hasError={pagination.hasError}
            loading={pagination.loading}
            onLoad={pagination.load}
          />
          {visibleMessages.length === 0 && !participantTyping ? (
            <div className="flex flex-1 items-center justify-center text-center text-copy text-body">
              {emptyMessage}
            </div>
          ) : (
            <ol className="flex flex-col">
              {visibleMessages.map((message, index) => (
                <ChatMessageRow
                  key={message.clientRequestId}
                  message={message}
                  previous={visibleMessages[index - 1]}
                  next={visibleMessages[index + 1]}
                  messages={allMessages}
                  replyMessages={replyMessages}
                  currentUserId={chat.currentUserId}
                  currentUserRole={chat.currentUserRole}
                  isCommunity={isCommunity}
                  friendActionsEnabled={friendActionsEnabled}
                  participantReadState={participantReadState}
                  latestMineRequestId={latestMineRequestId}
                  showUnreadDivider={message.id === firstLoadedUnreadMessageId}
                  isFocused={message.id === focusMessageId}
                  getAuthorName={getAuthorName}
                  getAuthorAvatar={getAuthorAvatar}
                  getAuthorMember={getAuthorMember}
                  actions={actions}
                  editing={editing}
                />
              ))}
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
      {viewport.showNewMessages && (
        <button
          type="button"
          onClick={() => viewport.scrollToBottom()}
          className="absolute inset-x-0 bottom-sm mx-auto inline-flex min-h-control w-fit items-center gap-2xs rounded-pill border border-border bg-surface px-md text-ui-sm text-body hover:bg-surface-2"
        >
          <IconArrowDown size={18} stroke={1.75} aria-hidden="true" />
          New messages
        </button>
      )}
      {!viewport.showNewMessages && viewport.isReconnecting && (
        <div
          role="status"
          className="absolute inset-x-0 bottom-sm mx-auto inline-flex min-h-control w-fit items-center gap-2xs rounded-pill border border-border bg-surface px-md text-ui-sm text-muted"
        >
          Reconnecting…
        </div>
      )}
    </div>
  );
}
