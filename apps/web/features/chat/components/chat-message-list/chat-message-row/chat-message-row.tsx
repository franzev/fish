import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import {
  getMessageSnippet,
  getOutgoingMessageStatus,
} from "@/features/chat/model/chat-state";
import { belongsToSameMessageGroup } from "@/features/chat/model/message-grouping";
import type { ClientChatReadState } from "@/lib/services";
import { cn } from "@/lib/utils";
import { isChatStickerId, type ChatStickerId } from "@fish/core/chat";
import { useEffect, useRef } from "react";
import {
  Avatar,
  CommunityMessageRowLayout,
  getBubbleRadiusClasses,
  MessageBody,
  MessageMeta,
  MessageImages,
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
import {
  MessageActions,
  type MessageActionResult,
} from "../message-actions";
import { MessageEditor } from "../message-editor";
import { formatChatDayLabel } from "./chat-day-label";

export interface ChatMessageActions {
  canDelete: boolean;
  reply: (message: LocalMessage) => void;
  toggleReaction: (message: LocalMessage, emoji: string) => Promise<void>;
  delete: (message: LocalMessage) => Promise<MessageActionResult>;
  reportGif: (message: LocalMessage) => Promise<void>;
  retry: (
    body: string,
    clientRequestId: string,
    replyToMessageId: string | null,
    clearComposer?: boolean,
    attachmentIds?: string[],
    images?: NonNullable<LocalMessage["images"]>,
    stickerId?: ChatStickerId,
    gif?: LocalMessage["gif"]
  ) => Promise<void>;
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

interface ChatMessageRowProps {
  message: LocalMessage;
  previous?: LocalMessage;
  next?: LocalMessage;
  messages: LocalMessage[];
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
  const wasEditingRef = useRef(isEditing);

  useEffect(() => {
    if (wasEditingRef.current && !isEditing) rowRef.current?.focus();
    wasEditingRef.current = isEditing;
  }, [isEditing]);

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
    (message.localStatus === "failed" || (compactSent && !isCommunity));
  const replyMessage = message.replyToMessageId
    ? messages.find((item) => item.id === message.replyToMessageId) ?? null
    : null;
  const startsCommunityGroup =
    isCommunity && (!groupedWithPrevious || Boolean(replyMessage));
  const showParticipantAvatar = isCommunity
    ? startsCommunityGroup
    : !mine && !groupedWithNext;
  const messageDay = new Date(message.createdAt).toDateString();
  const previousDay = previous
    ? new Date(previous.createdAt).toDateString()
    : null;
  const dayDividerLabel =
    previousDay !== messageDay ? formatChatDayLabel(message.createdAt) : null;
  const showMessageActions =
    message.localStatus === "sent" && !message.deletedAt && !interactionDisabled;
  const authorMember = getAuthorMember(message);
  const visualImageCount =
    message.images?.filter((attachment) => attachment.kind !== "file").length ?? 0;
  const messageSurfaceWidthClass = isEditing
    ? "w-full max-w-message"
    : visualImageCount === 1
      ? "w-full max-w-chat-preview"
      : visualImageCount > 1
        ? "w-full max-w-message"
        : message.images?.length
          ? "w-full max-w-chat-image"
          : message.gif
            ? "w-full max-w-chat-gif"
            : message.stickerId
              ? "w-fit max-w-message"
              : "max-w-message";

  const rowContent = (
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
      {startsCommunityGroup && (
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
      {Boolean(message.images?.length) && !message.deletedAt && (
        <MessageImages images={message.images ?? []} authorName={getAuthorName(message)} mine={mine} />
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
      {message.editedAt && !message.deletedAt && !isEditing && (
        <p className="mt-2xs text-ui-xs text-muted">Edited</p>
      )}
      {showMessageActions && (
        <MessageActions
          mine={mine}
          canEdit={editing.enabled && Boolean(message.body.trim())}
          canDelete={actions.canDelete}
          canReportGif={Boolean(message.gif)}
          onReply={() => actions.reply(message)}
          onReact={(emoji) => void actions.toggleReaction(message, emoji)}
          onEdit={() => editing.start(message)}
          onDelete={() => actions.delete(message)}
          onReportGif={() => void actions.reportGif(message)}
        />
      )}
      <Reactions
        reactions={message.reactions}
        onToggle={(emoji) => void actions.toggleReaction(message, emoji)}
        disabled={interactionDisabled}
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
              className="min-h-control rounded-control px-xs py-2xs text-body underline"
              onClick={() =>
                void actions.retry(
                  message.body,
                  message.clientRequestId,
                  message.replyToMessageId ?? null,
                  false,
                  message.images?.map((image) => image.id) ?? [],
                  message.images ?? [],
                  isChatStickerId(message.stickerId) ? message.stickerId : undefined,
                  message.gif
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
      {dayDividerLabel && !showUnreadDivider && (
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
      {showUnreadDivider && (
        <li role="none">
          <UnreadDivider dateLabel={dayDividerLabel ?? undefined} />
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
            startsGroup={startsCommunityGroup}
            hasPrecedingRow={Boolean(previous)}
            interactive
            className={cn(
              isFocused && "bg-chat-active hover:bg-chat-active"
            )}
          >
            {rowContent}
          </CommunityMessageRowLayout>
        ) : (
          <>
            {!mine &&
              (showParticipantAvatar ? (
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
                "relative flex flex-col",
                messageSurfaceWidthClass,
                mine && "items-end"
              )}
            >
              {rowContent}
            </div>
          </>
        )}
      </li>
    </>
  );
}
