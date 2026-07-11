import { ScrollArea } from "@/components/ui/scroll-area";
import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import type { ClientChatData, ClientChatReadState } from "@/lib/services";
import { IconArrowDown } from "@tabler/icons-react";
import type { RefObject } from "react";
import { TypingIndicator } from "../visual";
import {
  ChatMessageRow,
  type ChatMessageActions,
} from "./chat-message-row";
import { OlderMessagesControl } from "./older-messages-control";

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
    search: string;
    isCommunity: boolean;
    activityName: string;
    chat: ClientChatData;
    participantReadState?: ClientChatReadState;
    latestMineRequestId: string | null;
    getAuthorName: (message: LocalMessage) => string;
  };
  actions: ChatMessageActions;
}

/** Coordinates transcript scrolling and delegates pagination and row details
 * to focused private components. */
export function ChatMessageList({
  viewport,
  pagination,
  transcript,
  actions,
}: ChatMessageListProps) {
  const {
    visibleMessages,
    allMessages,
    participantTyping,
    search,
    isCommunity,
    activityName,
    chat,
    participantReadState,
    latestMineRequestId,
    getAuthorName,
  } = transcript;

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
              {search
                ? "No messages match"
                : isCommunity
                  ? "No messages yet. Say hello to the community."
                  : "No messages yet."}
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
                  currentUserId={chat.currentUserId}
                  isCommunity={isCommunity}
                  participantReadState={participantReadState}
                  latestMineRequestId={latestMineRequestId}
                  getAuthorName={getAuthorName}
                  actions={actions}
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
          className="absolute inset-x-0 bottom-sm mx-auto inline-flex min-h-control w-fit items-center gap-2xs rounded-pill border border-border bg-surface px-md text-ui-sm text-body shadow-popover hover:bg-surface-2"
        >
          <IconArrowDown size={18} stroke={1.75} aria-hidden="true" />
          New messages
        </button>
      )}
      {!viewport.showNewMessages && viewport.isReconnecting && (
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
