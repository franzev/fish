"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { CallButton } from "@/features/calls";
import { FriendConversationActions } from "@/features/friends";
import type { ClientChatData, FriendProfile } from "@/lib/services";
import { IconLanguage, IconLock, IconUserCheck } from "@tabler/icons-react";
import { Avatar } from "../avatar";

export interface ConversationDetailsSidebarProps {
  chat: ClientChatData;
  friend?: FriendProfile | null;
}

export function ConversationDetailsSidebar({
  chat,
  friend,
}: ConversationDetailsSidebarProps) {
  const isFriendConversation =
    chat.currentUserRole === "client" && chat.participant.role === "client";
  const participantLabel =
    chat.currentUserRole === "coach" ? "Your client" : "Your coach";
  const assignedParticipantLabel =
    chat.currentUserRole === "coach"
      ? "Your assigned client"
      : "Your assigned coach";
  const privacyCopy = isFriendConversation
    ? "Only you and your friend can take part."
    : chat.currentUserRole === "coach"
      ? "Only you and your client can take part."
      : "Only you and your coach can take part.";

  return (
    <aside
      id="conversation-details"
      aria-label="Conversation details"
      className="hidden w-conversation-details shrink-0 flex-col border-l border-divider bg-surface xl:flex"
    >
      <div className="flex h-chat-header shrink-0 items-center justify-between border-b border-divider px-md">
        <h2 className="font-serif text-heading-sm font-semibold text-foreground">
          Details
        </h2>
        {friend ? (
          <FriendConversationActions friend={friend} successHref="/messages" />
        ) : null}
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
                  <dd className="mt-2xs text-ui-sm text-muted">
                    English coaching
                  </dd>
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
              <dd className="mt-2xs text-ui-sm text-muted">{privacyCopy}</dd>
            </div>
          </div>
        </dl>
      </ScrollArea>
    </aside>
  );
}
