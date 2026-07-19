import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import {
  getMessageSnippet,
  getOutgoingMessageStatus,
} from "@/features/chat/model/chat-state";
import type { ClientChatReadState } from "@/lib/services";
import { cn } from "@/lib/utils";
import { isChatStickerId } from "@fish/core/chat";
import { useEffect, useRef } from "react";
import {
  Avatar,
  CommunityMessageRowLayout,
  getBubbleRadiusClasses,
  MessageBody,
  MessageMeta,
  MessageAttachments,
  MessageGif,
  StickerMedia,
  MessageStatus,
  QuotedMessage,
  Reactions,
} from "../../visual";
import { visibleMessageBody } from "../../message-presentation";
import {
  MemberProfilePopover,
  type CommunityMemberProfile,
} from "../../member-profile-popover";
import { UnreadDivider } from "../../unread-divider";
import { MessageActions } from "../message-actions";
import { MessageEditor } from "../message-editor";
import { DayDivider } from "../day-divider";
import type { SendWithRequestIdOptions } from "@/features/chat/hooks/use-send-message";
import type {
  ChatMessageActions,
  ChatMessageEditingState,
} from "../chat-message-list";
import { deriveRowPresentation } from "./row-presentation";

interface ChatMessageRowProps {
  message: LocalMessage;
  previous?: LocalMessage;
  next?: LocalMessage;
  messages: LocalMessage[];
  replyMessages: ReadonlyMap<string, LocalMessage>;
  currentUserId: string;
  currentUserRole: "client" | "coach";
  isCommunity: boolean;
  friendActionsEnabled: boolean;
  participantReadState?: ClientChatReadState;
  latestMineRequestId: string | null;
  showUnreadDivider?: boolean;
  isFocused?: boolean;
  getAuthorName: (message: LocalMessage) => string;
  getAuthorAvatar: (message: LocalMessage) => string | null | undefined;
  getAuthorMember: (message: LocalMessage) => CommunityMemberProfile;
  actions: ChatMessageActions;
  editing: ChatMessageEditingState;
}

/** Renders one transcript item and derives only row-local presentation state. */
export function ChatMessageRow({
  message,
  previous,
  next,
  messages,
  replyMessages,
  currentUserId,
  currentUserRole,
  isCommunity,
  friendActionsEnabled,
  participantReadState,
  latestMineRequestId,
  showUnreadDivider = false,
  isFocused = false,
  getAuthorName,
  getAuthorAvatar,
  getAuthorMember,
  actions,
  editing,
}: ChatMessageRowProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const mine = message.senderId === currentUserId;
  const isEditing = editing.messageId === message.id;
  const interactionDisabled = editing.messageId !== null;
  const reactionsDisabled =
    interactionDisabled || Boolean(actions.isReactionPending?.(message.id));
  const wasEditingRef = useRef(isEditing);

  useEffect(() => {
    if (wasEditingRef.current && !isEditing) rowRef.current?.focus();
    wasEditingRef.current = isEditing;
  }, [isEditing]);

  const replyMessage = message.replyToMessageId
    ? replyMessages.get(message.replyToMessageId) ?? null
    : null;
  const presentation = deriveRowPresentation(message, previous, next, {
    currentUserId,
    isCommunity,
    latestMineRequestId,
    isEditing,
    replyMessage,
  });
  const { groupedWithPrevious, groupedWithNext } = presentation;
  const connectedBubbleRadius = getBubbleRadiusClasses({
    mine,
    groupedWithPrevious,
    groupedWithNext,
  });
  const deliveryStatus = mine
    ? getOutgoingMessageStatus(message, messages, participantReadState)
    : "sent";
  const showMessageActions =
    message.localStatus === "sent" && !message.deletedAt && !interactionDisabled;
  const authorMember = getAuthorMember(message);
  const attachments = message.attachments ?? message.images ?? [];

  const messagePrimaryContent = (
    <>
      {isCommunity && replyMessage && (
        <div className="relative mb-2xs flex items-center gap-2xs self-stretch text-ui-xs text-muted">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-reply-spline-left top-compact h-sm w-lg rounded-tl-chat-inner border-l border-t border-border"
          />
          <Avatar
            profileId={replyMessage.senderId}
            src={getAuthorAvatar(replyMessage) ?? undefined}
            name={getAuthorName(replyMessage)}
            size="xs"
            alt=""
          />
          <span className="shrink-0 font-medium text-body">
            {getAuthorName(replyMessage)}
          </span>
          <span className="min-w-0 truncate">
            {getMessageSnippet(replyMessage)}
          </span>
        </div>
      )}
      {presentation.startsCommunityGroup && (
        <MessageMeta
          authorName={getAuthorName(message)}
          sentAt={message.createdAt}
          tag={message.senderRole === "coach" ? "Coach" : undefined}
          authorControl={
            <MemberProfilePopover
              member={authorMember}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              friendActionsEnabled={friendActionsEnabled}
              trigger="name"
            />
          }
        />
      )}
      {!isCommunity && replyMessage && (
        <QuotedMessage
          authorName={getAuthorName(replyMessage)}
          snippet={getMessageSnippet(replyMessage)}
        />
      )}
      {attachments.length > 0 && !message.deletedAt && (
        <MessageAttachments images={attachments} authorName={getAuthorName(message)} mine={mine} />
      )}
      {message.stickerId && !message.deletedAt && (
        <StickerMedia stickerId={message.stickerId} />
      )}
      {message.gif && !message.deletedAt && <MessageGif gif={message.gif} />}
      {isEditing ? (
        <MessageEditor
          originalBody={message.body}
          draft={editing.draft}
          notice={editing.notice}
          saving={editing.saving}
          onChange={editing.change}
          onSave={editing.save}
          onCancel={editing.cancel}
        />
      ) : (
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
      )}
    </>
  );

  const messageActions = showMessageActions ? (
    <MessageActions
      mine={mine}
      layout={isCommunity ? "community" : "direct"}
      canEdit={editing.enabled && Boolean(message.body.trim())}
      canDelete={actions.canDelete}
      canReportGif={Boolean(message.gif)}
      reactionsDisabled={reactionsDisabled}
      onReply={() => actions.reply(message)}
      onReact={(emoji) => void actions.toggleReaction(message, emoji)}
      onEdit={() => editing.start(message)}
      onDelete={() => actions.delete(message)}
      onReportGif={() => void actions.reportGif(message)}
    />
  ) : null;

  const messageSupplementalContent = (
    <>
      {message.editedAt && !message.deletedAt && !isEditing && (
        <p className="mt-2xs text-ui-xs text-muted">Edited</p>
      )}
      <Reactions
        reactions={message.reactions}
        onToggle={(emoji) => void actions.toggleReaction(message, emoji)}
        disabled={reactionsDisabled}
        className="mt-2xs"
      />
      <div
        className={cn(
          "flex min-h-5 items-center gap-xs text-ui-xs text-muted",
          !presentation.showStatus && "hidden",
          mine && !isCommunity ? "justify-end" : "justify-start"
        )}
      >
        {presentation.compactSent && <MessageStatus status={deliveryStatus} />}
        {mine && message.localStatus === "failed" && (
          <>
            <span>Not sent yet</span>
            <button
              type="button"
              className="min-h-control rounded-control px-xs py-2xs text-body underline"
              onClick={() =>
                void actions.retry({
                  body: message.body,
                  clientRequestId: message.clientRequestId,
                  replyToMessageId: message.replyToMessageId ?? null,
                  clearComposer: false,
                  attachmentIds: attachments.map((attachment) => attachment.id),
                  optimisticImages: attachments,
                  optimisticStickerId: isChatStickerId(message.stickerId) ? message.stickerId : undefined,
                  optimisticGif: message.gif,
                } satisfies SendWithRequestIdOptions)
              }
            >
              Retry
            </button>
          </>
        )}
      </div>
    </>
  );

  const communityRowContent = (
    <>
      {messagePrimaryContent}
      {messageActions}
      {messageSupplementalContent}
    </>
  );

  const communityAvatarSlot = presentation.showParticipantAvatar ? (
    <MemberProfilePopover
      member={authorMember}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      friendActionsEnabled={friendActionsEnabled}
      trigger="avatar"
      className={cn(replyMessage && "mt-lg")}
    />
  ) : (
    <div aria-hidden="true" className="size-8 shrink-0" />
  );

  return (
    <>
      {presentation.dayDividerLabel && !showUnreadDivider && (
        <DayDivider label={presentation.dayDividerLabel} />
      )}
      {showUnreadDivider && (
        <li role="none">
          <UnreadDivider dateLabel={presentation.dayDividerLabel ?? undefined} />
        </li>
      )}
      <li
        ref={rowRef}
        tabIndex={-1}
        id={`message-${message.id}`}
        className={cn(
          "scroll-mt-md",
          isFocused && !isCommunity && "bg-chat-active",
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
            startsGroup={presentation.startsCommunityGroup}
            hasPrecedingRow={Boolean(previous)}
            interactive
            className={cn(
              isFocused && "bg-chat-active hover:bg-chat-active"
            )}
          >
            {communityRowContent}
          </CommunityMessageRowLayout>
        ) : (
          <>
            {!mine &&
              (presentation.showParticipantAvatar ? (
                <Avatar
                  profileId={message.senderId}
                  src={getAuthorAvatar(message) ?? undefined}
                  name={getAuthorName(message)}
                  size="sm"
                  alt=""
                />
              ) : (
                <div aria-hidden="true" className="size-8 shrink-0" />
              ))}
            <div
              className={cn(
                "flex flex-col",
                presentation.surfaceWidthClass,
                mine && "items-end"
              )}
            >
              <div
                data-message-action-anchor="direct"
                className={cn(
                  "relative flex w-full flex-col",
                  mine && "items-end"
                )}
              >
                {messagePrimaryContent}
                {messageActions}
              </div>
              {messageSupplementalContent}
            </div>
          </>
        )}
      </li>
    </>
  );
}
