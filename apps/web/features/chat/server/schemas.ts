import { chatLimits } from "@fish/core/chat";
import { z } from "zod";

export const sendMessageSchema = z.strictObject({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(chatLimits.messageBodyMaxLength),
  clientRequestId: z.string().trim().min(1).max(120),
  replyToMessageId: z.string().trim().min(1).nullable().optional(),
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
