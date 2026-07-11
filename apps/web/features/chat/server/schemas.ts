import { chatLimits } from "@fish/core/chat";
import { z } from "zod";

export const sendMessageSchema = z.strictObject({
  conversationId: z.string().uuid(),
  body: z.string().trim().max(chatLimits.messageBodyMaxLength),
  clientRequestId: z.string().trim().min(1).max(120),
  replyToMessageId: z.string().trim().min(1).nullable().optional(),
  attachmentIds: z.array(z.string().uuid()).max(chatLimits.imageMaxCount).optional(),
}).refine((value) => value.body.length > 0 || (value.attachmentIds?.length ?? 0) > 0, {
  message: "Message content is required",
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

export const markReadStateSchema = z.strictObject({
  conversationId: z.string().uuid(),
  lastDeliveredMessageId: z.string().trim().min(1).nullable(),
  lastReadMessageId: z.string().trim().min(1).nullable(),
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
