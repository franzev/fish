import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import { belongsToSameMessageGroup } from "@/features/chat/model/message-grouping";
import { formatChatDayLabel, isSameLocalCalendarDay } from "./chat-day-label";

export interface RowPresentationContext {
  currentUserId: string;
  isCommunity: boolean;
  latestMineRequestId: string | null;
  isEditing: boolean;
  replyMessage?: LocalMessage | null;
}

export interface RowPresentation {
  groupedWithPrevious: boolean;
  groupedWithNext: boolean;
  compactSent: boolean;
  showStatus: boolean;
  startsCommunityGroup: boolean;
  showParticipantAvatar: boolean;
  dayDividerLabel: string | null;
  surfaceWidthClass: string;
}

export function getMessageSurfaceWidthClass(
  message: LocalMessage,
  isEditing: boolean
): string {
  if (isEditing) return "w-full max-w-message";
  const attachments = message.attachments ?? message.images ?? [];
  const visualImageCount = attachments.filter(
    (attachment) => attachment.kind !== "file"
  ).length;
  if (visualImageCount === 1) return "w-full max-w-chat-preview";
  if (visualImageCount > 1) return "w-full max-w-message";
  if (attachments.length) return "w-full max-w-chat-image";
  if (message.gif) return "w-full max-w-chat-gif";
  if (message.stickerId) return "w-fit max-w-message";
  return "max-w-message";
}

export function deriveRowPresentation(
  message: LocalMessage,
  previous: LocalMessage | undefined,
  next: LocalMessage | undefined,
  context: RowPresentationContext,
  now = new Date()
): RowPresentation {
  const mine = message.senderId === context.currentUserId;
  const groupedWithPrevious = belongsToSameMessageGroup(previous, message);
  const groupedWithNext = Boolean(
    next && belongsToSameMessageGroup(message, next)
  );
  const compactSent =
    mine &&
    message.localStatus === "sent" &&
    message.clientRequestId === context.latestMineRequestId;
  const startsCommunityGroup =
    context.isCommunity &&
    (!groupedWithPrevious || Boolean(context.replyMessage));
  const showParticipantAvatar = context.isCommunity
    ? startsCommunityGroup
    : !mine && !groupedWithNext;
  const dayDividerLabel =
    !previous ||
    !isSameLocalCalendarDay(
      new Date(previous.createdAt),
      new Date(message.createdAt)
    )
      ? formatChatDayLabel(message.createdAt, now)
      : null;

  return {
    groupedWithPrevious,
    groupedWithNext,
    compactSent,
    showStatus:
      mine &&
      (message.localStatus === "failed" ||
        (compactSent && !context.isCommunity)),
    startsCommunityGroup,
    showParticipantAvatar,
    dayDividerLabel,
    surfaceWidthClass: getMessageSurfaceWidthClass(message, context.isEditing),
  };
}
