import { chatLimits, chatStickerIds } from "@fish/core/chat";
import { z } from "zod";

const httpsUrl = z.url().max(2000).refine((value) => value.startsWith("https://"), {
  message: "GIF URLs must use HTTPS",
});

function hostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export const chatGifSchema = z.strictObject({
  provider: z.enum(["klipy", "giphy"]),
  providerId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(500),
  sourceUrl: httpsUrl,
  posterUrl: httpsUrl,
  previewUrl: httpsUrl,
  mediaUrl: httpsUrl,
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
}).superRefine((gif, context) => {
  const sourceHost = hostname(gif.sourceUrl);
  const mediaHosts = [gif.posterUrl, gif.previewUrl, gif.mediaUrl].map(hostname);
  const valid = gif.provider === "klipy"
    ? (sourceHost === "klipy.com" || sourceHost.endsWith(".klipy.com"))
      && mediaHosts.every((host) => /^static\d*\.klipy\.com$/.test(host))
    : (sourceHost === "giphy.com" || sourceHost.endsWith(".giphy.com"))
      && mediaHosts.every((host) => /^media\d*\.giphy\.com$/.test(host));
  if (!valid) {
    context.addIssue({ code: "custom", message: "GIF source is not allowed" });
  }
});

export const sendMessageSchema = z.strictObject({
  conversationId: z.string().uuid(),
  body: z.string().trim().max(chatLimits.messageBodyMaxLength),
  clientRequestId: z.string().trim().min(1).max(120),
  replyToMessageId: z.string().trim().min(1).nullable().optional(),
  attachmentIds: z.array(z.string().uuid()).max(chatLimits.imageMaxCount).optional(),
  gif: chatGifSchema.optional(),
  stickerId: z.enum(chatStickerIds).optional(),
}).refine((value) =>
  value.body.length > 0
  || (value.attachmentIds?.length ?? 0) > 0
  || value.gif
  || value.stickerId,
{
  message: "Message content is required",
}).refine((value) => !(value.gif && (value.attachmentIds?.length ?? 0) > 0), {
  message: "A GIF cannot be combined with files",
}).refine((value) => !(
  value.stickerId
  && (value.gif || (value.attachmentIds?.length ?? 0) > 0)
), {
  message: "A sticker cannot be combined with other media",
});

export const editMessageSchema = z.strictObject({
  messageId: z.string().trim().min(1),
  body: z.string().trim().min(1).max(chatLimits.messageBodyMaxLength),
});

export const deleteMessageSchema = z.strictObject({
  messageId: z.string().trim().min(1),
});

export const toggleReactionSchema = z.strictObject({
  messageId: z.string().trim().min(1),
  emoji: z.string().trim().min(1).max(16),
});

export const reportGifSchema = z.strictObject({
  messageId: z.string().uuid(),
});

export const markReadStateSchema = z.strictObject({
  conversationId: z.string().uuid(),
  lastDeliveredMessageId: z.string().trim().min(1).nullable(),
  lastReadMessageId: z.string().trim().min(1).nullable(),
});

export const unreadSummarySchema = z.strictObject({
  conversationId: z.string().uuid(),
});

export const refreshMessagesSchema = z.strictObject({
  messageIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

export const refreshConversationSchema = z.strictObject({
  conversationId: z.string().uuid(),
});

const chatCursorInputSchema = z.strictObject({
  // Postgres/PostgREST serialises timestamptz with a numeric offset
  // ("2026-07-10T02:18:36.332408+00:00"), not a "Z" suffix. Zod 4's
  // z.iso.datetime() rejects offsets by default, which silently failed the
  // keyset cursor and surfaced "Couldn't load earlier messages."
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string().uuid(),
});

export const loadOlderMessagesSchema = z.strictObject({
  conversationId: z.string().uuid(),
  cursor: chatCursorInputSchema.nullable().optional(),
  offset: z.number().int().nonnegative().max(1_000_000).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export const backfillMessagesSchema = z.strictObject({
  conversationId: z.string().uuid(),
  // Same offset-timestamp reason as chatCursorInputSchema.createdAt above.
  afterCreatedAt: z.iso.datetime({ offset: true }),
  afterMessageId: z.string().uuid(),
  limit: z.number().int().positive().max(100).optional(),
});

export const loadNewestMessagesSchema = z.strictObject({
  conversationId: z.string().uuid(),
  limit: z.number().int().positive().max(100).optional(),
});

const searchDateSchema = z.strictObject({
  operator: z.enum(["before", "after", "during"]),
  date: z.iso.date(),
  timeZone: z.string().trim().min(1).max(100),
});

export const searchChatMessagesSchema = z.strictObject({
  conversationId: z.string().uuid(),
  text: z.string().trim().max(4000),
  senderIds: z.array(z.string().uuid()).max(100),
  mentionedUserIds: z.array(z.string().uuid()).max(100),
  channelIds: z.array(z.string().uuid()).max(100),
  contentKinds: z
    .array(z.enum(["image", "video", "link", "file", "embed"]))
    .max(5),
  authorTypes: z.array(z.enum(["client", "coach"])).max(2),
  pinned: z.boolean().nullable(),
  dates: z.array(searchDateSchema).max(10),
  cursor: chatCursorInputSchema.nullable().optional(),
  offset: z.number().int().nonnegative().max(1_000_000).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
});
