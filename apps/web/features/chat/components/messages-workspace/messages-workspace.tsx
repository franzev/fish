"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationDetailsContext } from "../conversation-details-context";
import { ConversationPreviewRow } from "../conversation-preview-row";
import { getMessageSnippet } from "@/features/chat/model/chat-state";
import {
  selectMessagesForConversation,
  useChatStore,
} from "@/features/chat/model/store";
import type {
  ClientChatData,
  ClientChatMessage,
  ClientDirectConversationPreview,
} from "@/lib/services";
import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface MessagesWorkspaceProps {
  chat: ClientChatData;
  conversations?: ClientDirectConversationPreview[];
  conversationDetails?: ReactNode;
  children: ReactNode;
}

/**
 * Frames a direct conversation with desktop-only context. Each direct route
 * has one assigned relationship, so the rail stays a single destination
 * rather than a marketplace-style inbox with unsupported filters and actions.
 */
export function MessagesWorkspace({
  chat,
  conversations = [],
  conversationDetails,
  children,
}: MessagesWorkspaceProps) {
  const [detailsConversationId, setDetailsConversationId] = useState<
    string | null
  >(null);
  const detailsOpen = detailsConversationId === chat.conversationId;
  const closeDetails = useCallback(() => setDetailsConversationId(null), []);
  const toggleDetails = useCallback(() => {
    setDetailsConversationId((current) =>
      current === chat.conversationId ? null : chat.conversationId
    );
  }, [chat.conversationId]);
  const detailsContext = useMemo(
    () => ({
      available: Boolean(conversationDetails),
      open: detailsOpen,
      close: closeDetails,
      toggle: toggleDetails,
    }),
    [closeDetails, conversationDetails, detailsOpen, toggleDetails]
  );

  const storedMessages = useChatStore((state) =>
    selectMessagesForConversation(state, chat.conversationId)
  ) as ClientChatMessage[];
  const messages = storedMessages.length > 0 ? storedMessages : chat.messages;
  const latestMessage = messages.at(-1);
  const latestSnippet = latestMessage
    ? getMessageSnippet(latestMessage)
    : "Start the conversation";
  const preview = latestMessage?.senderId === chat.currentUserId
    ? `You: ${latestSnippet}`
    : latestSnippet;
  const activePreview: ClientDirectConversationPreview = {
    conversationId: chat.conversationId,
    participant: chat.participant,
    latestMessage: latestMessage
      ? {
          senderId: latestMessage.senderId,
          text: latestSnippet,
          createdAt: latestMessage.createdAt,
        }
      : null,
    unreadCount: conversations.find(
      (item) => item.conversationId === chat.conversationId
    )?.unreadCount ?? 0,
  };
  const conversationItems = conversations.some(
    (item) => item.conversationId === chat.conversationId
  )
    ? conversations.map((item) =>
        item.conversationId === chat.conversationId ? activePreview : item
      )
    : [activePreview, ...conversations];

  return (
    <ConversationDetailsContext.Provider value={detailsContext}>
      <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
      <aside
        aria-label="Conversations"
        className="hidden w-conversation-list shrink-0 flex-col border-r border-divider bg-surface lg:flex"
      >
        <div className="flex h-chat-header shrink-0 items-center border-b border-divider px-md">
          <h1 className="font-serif text-heading-sm font-semibold text-foreground">
            Messages
          </h1>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Direct conversations" className="flex flex-col gap-3xs p-2xs">
            {conversationItems.map((item) => {
              const itemLatest = item.latestMessage;
              const itemPreview = item.conversationId === chat.conversationId
                ? preview
                : itemLatest
                ? `${itemLatest.senderId === item.participant.id ? "" : "You: "}${itemLatest.text}`
                : "Start the conversation";
              return (
                <ConversationPreviewRow
                  key={item.conversationId}
                  href={`/messages/${item.conversationId}`}
                  participant={item.participant}
                  preview={itemPreview}
                  latestMessageAt={itemLatest?.createdAt}
                  unreadCount={item.unreadCount}
                  active={item.conversationId === chat.conversationId}
                  presentation="rail"
                />
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

        <div className="flex min-h-0 min-w-0 flex-1">{children}</div>

        {detailsOpen ? (
          <Fragment key="conversation-details">{conversationDetails}</Fragment>
        ) : null}
      </div>
    </ConversationDetailsContext.Provider>
  );
}
