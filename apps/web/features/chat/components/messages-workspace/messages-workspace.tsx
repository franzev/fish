"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "../avatar";
import { ConversationPreviewRow } from "../conversation-preview-row";
import { getMessageSnippet } from "@/features/chat/model/chat-state";
import { CallButton } from "@/features/calls";
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
  IconLanguage,
  IconLock,
  IconUserCheck,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export interface MessagesWorkspaceProps {
  chat: ClientChatData;
  conversations?: ClientDirectConversationPreview[];
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
  children,
}: MessagesWorkspaceProps) {
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
  const isFriendConversation = chat.currentUserRole === "client"
    && chat.participant.role === "client";
  const participantLabel = chat.currentUserRole === "coach"
    ? "Your client"
    : "Your coach";
  const assignedParticipantLabel = chat.currentUserRole === "coach"
    ? "Your assigned client"
    : "Your assigned coach";
  const privacyCopy = isFriendConversation
    ? "Only you and your friend can take part."
    : chat.currentUserRole === "coach"
    ? "Only you and your client can take part."
    : "Only you and your coach can take part.";
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
    <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
      <aside
        aria-label="Conversations"
        className="hidden w-conversation-list shrink-0 flex-col border-r border-divider bg-surface lg:flex"
      >
        <div className="flex h-chat-header shrink-0 items-center border-b border-divider px-md">
          <h1 className="font-sans text-heading-sm font-semibold text-foreground">
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

      <aside
        aria-label="Conversation details"
        className="hidden w-conversation-details shrink-0 flex-col border-l border-divider bg-surface xl:flex"
      >
        <div className="flex h-chat-header shrink-0 items-center border-b border-divider px-md">
          <h2 className="font-sans text-heading-sm font-semibold text-foreground">
            Details
          </h2>
        </div>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="px-md py-lg">
          <div className="flex flex-col items-center text-center">
            <Avatar
              profileId={chat.participant.id}
              src={chat.participant.avatarUrl ?? undefined}
              name={chat.participant.displayName}
              size="lg"
            />
            <h3 className="mt-sm font-sans text-heading-sm font-semibold text-foreground">
              {chat.participant.displayName}
            </h3>
            {!isFriendConversation ? (
              <p className="mt-2xs text-ui-sm text-muted">{participantLabel}</p>
            ) : null}
            <div
              role="group"
              aria-label={`Call ${chat.participant.displayName}`}
              className="mt-md grid w-full grid-cols-2 gap-xs"
            >
              <CallButton
                recipientId={chat.participant.id}
                recipientName={chat.participant.displayName}
                kind="audio"
                presentation="labeled"
              />
              <CallButton
                recipientId={chat.participant.id}
                recipientName={chat.participant.displayName}
                kind="video"
                presentation="labeled"
              />
            </div>
          </div>

          <dl className="mt-xl divide-y divide-divider">
            {isFriendConversation ? (
              <div className="flex gap-sm py-md">
                <IconUserCheck
                  size={20}
                  stroke={1.75}
                  aria-hidden="true"
                  className="mt-3xs shrink-0 text-muted"
                />
                <div>
                  <dt className="text-ui text-foreground">Friend</dt>
                  <dd className="mt-2xs text-ui-sm text-muted">
                    You’re friends on FISH.
                  </dd>
                </div>
              </div>
            ) : (
              <>
            <div className="flex gap-sm py-md">
              <IconUserCheck
                size={20}
                stroke={1.75}
                aria-hidden="true"
                className="mt-3xs shrink-0 text-muted"
              />
              <div>
                <dt className="text-ui text-foreground">One-to-one coaching</dt>
                <dd className="mt-2xs text-ui-sm text-muted">
                  {assignedParticipantLabel}
                </dd>
              </div>
            </div>
            <div className="flex gap-sm py-md">
              <IconLanguage
                size={20}
                stroke={1.75}
                aria-hidden="true"
                className="mt-3xs shrink-0 text-muted"
              />
              <div>
                <dt className="text-ui text-foreground">Focus</dt>
                <dd className="mt-2xs text-ui-sm text-muted">English coaching</dd>
              </div>
            </div>
              </>
            )}
            <div className="flex gap-sm py-md">
              <IconLock
                size={20}
                stroke={1.75}
                aria-hidden="true"
                className="mt-3xs shrink-0 text-muted"
              />
              <div>
                <dt className="text-ui text-foreground">Private conversation</dt>
                <dd className="mt-2xs text-ui-sm text-muted">
                  {privacyCopy}
                </dd>
              </div>
            </div>
          </dl>
        </ScrollArea>
      </aside>
    </div>
  );
}
