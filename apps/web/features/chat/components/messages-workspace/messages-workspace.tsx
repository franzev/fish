"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "../avatar";
import { ConversationPreviewRow } from "../conversation-preview-row";
import { getMessageSnippet } from "@/features/chat/model/chat-state";
import {
  selectMessagesForConversation,
  useChatStore,
} from "@/features/chat/model/store";
import type { ClientChatData, ClientChatMessage } from "@/lib/services";
import {
  IconLanguage,
  IconLock,
  IconUserCheck,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export interface MessagesWorkspaceProps {
  chat: ClientChatData;
  children: ReactNode;
}

/**
 * Frames a direct conversation with desktop-only context. Each direct route
 * has one assigned relationship, so the rail stays a single destination
 * rather than a marketplace-style inbox with unsupported filters and actions.
 */
export function MessagesWorkspace({ chat, children }: MessagesWorkspaceProps) {
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
  const participantLabel = chat.currentUserRole === "coach"
    ? "Your client"
    : "Your coach";
  const assignedParticipantLabel = chat.currentUserRole === "coach"
    ? "Your assigned client"
    : "Your assigned coach";
  const privacyCopy = chat.currentUserRole === "coach"
    ? "Only you and your client can take part."
    : "Only you and your coach can take part.";

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

        <nav aria-label="Direct conversations" className="p-2xs">
          <ConversationPreviewRow
            href={`/messages/${chat.conversationId}`}
            participant={chat.participant}
            preview={preview}
            latestMessageAt={latestMessage?.createdAt}
            active
            presentation="rail"
          />
        </nav>
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
            <p className="mt-2xs text-ui-sm text-muted">{participantLabel}</p>
          </div>

          <dl className="mt-xl divide-y divide-divider">
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
