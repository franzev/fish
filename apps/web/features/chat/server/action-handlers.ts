import type {
  ChatCommandService,
  ChatOperationResult,
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import { chatLimits } from "@fish/core/chat";
import type {
  MarkReadStateActionState,
  SendMessageActionState,
} from "../contracts";
import { sendNotice } from "./constants";
import {
  backfillMessagesSchema,
  deleteMessageSchema,
  editMessageSchema,
  loadNewestMessagesSchema,
  loadOlderMessagesSchema,
  markReadStateSchema,
  refreshConversationSchema,
  refreshMessagesSchema,
  reportGifSchema,
  sendMessageSchema,
  toggleReactionSchema,
} from "./schemas";

function messageActionState(
  values: unknown,
  result: ChatOperationResult<ClientChatMessage>
): SendMessageActionState {
  return result.ok
    ? { status: "sent", values, message: result.data }
    : { status: "notice", values, notice: result.notice };
}

export function createChatActionHandlers(chat: ChatCommandService) {
  return {
    async sendMessage(input: unknown): Promise<SendMessageActionState> {
      const parsed = sendMessageSchema.safeParse(input);
      if (!parsed.success) {
        const hasGif = typeof input === "object" && input !== null && "gif" in input;
        const hasSticker = typeof input === "object" && input !== null && "stickerId" in input;
        return {
          status: "notice",
          values: input,
          notice:
            typeof input === "object" &&
            input !== null &&
            "body" in input &&
            String((input as { body?: unknown }).body ?? "").length >
              chatLimits.messageBodyMaxLength
              ? "This message is a little long. Try sending it in two parts."
              : hasGif
                ? "That GIF is not available. Choose another one."
                : hasSticker
                  ? "That sticker is not available. Choose another one."
                : "Add a message before sending.",
        };
      }
      return messageActionState(
        parsed.data,
        await chat.sendMessage(parsed.data)
      );
    },

    async editMessage(input: unknown): Promise<SendMessageActionState> {
      const parsed = editMessageSchema.safeParse(input);
      if (!parsed.success) {
        return {
          status: "notice",
          values: input,
          notice:
            typeof input === "object" &&
            input !== null &&
            "body" in input &&
            String((input as { body?: unknown }).body ?? "").length >
              chatLimits.messageBodyMaxLength
              ? "This message is a little long. Try sending it in two parts."
              : "Add a message before saving.",
        };
      }
      return messageActionState(
        parsed.data,
        await chat.executeMessageCommand({ kind: "edit", ...parsed.data })
      );
    },

    async deleteMessage(input: unknown): Promise<SendMessageActionState> {
      const parsed = deleteMessageSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", values: input, notice: sendNotice };
      }
      return messageActionState(
        parsed.data,
        await chat.executeMessageCommand({ kind: "delete", ...parsed.data })
      );
    },

    async toggleReaction(input: unknown): Promise<SendMessageActionState> {
      const parsed = toggleReactionSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", values: input, notice: sendNotice };
      }
      return messageActionState(
        parsed.data,
        await chat.executeMessageCommand({
          kind: "toggleReaction",
          ...parsed.data,
        })
      );
    },

    async reportGif(input: unknown) {
      const parsed = reportGifSchema.safeParse(input);
      if (!parsed.success) {
        return {
          status: "notice" as const,
          values: input,
          notice: "That GIF is not available.",
        };
      }
      const result = await chat.reportGif(parsed.data);
      return result.ok
        ? { status: "sent" as const, values: parsed.data }
        : { status: "notice" as const, values: parsed.data, notice: result.notice };
    },

    async markReadState(input: unknown): Promise<MarkReadStateActionState> {
      const parsed = markReadStateSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", values: input, notice: sendNotice };
      }
      const result = await chat.markReadState(parsed.data);
      return result.ok
        ? { status: "sent", values: parsed.data, readState: result.data }
        : { status: "notice", values: parsed.data, notice: result.notice };
    },

    async refreshMessages(input: unknown): Promise<{
      status: "sent" | "notice";
      values: unknown;
      notice?: string;
      messages?: ClientChatMessage[];
    }> {
      const parsed = refreshMessagesSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", values: input, notice: sendNotice };
      }
      const result = await chat.refreshMessages(parsed.data);
      return result.ok
        ? { status: "sent", values: parsed.data, messages: result.data }
        : { status: "notice", values: parsed.data, notice: result.notice };
    },

    async refreshConversation(input: unknown): Promise<{
      status: "sent" | "notice";
      values: unknown;
      notice?: string;
      messages?: ClientChatMessage[];
      readStates?: ClientChatReadState[];
    }> {
      const parsed = refreshConversationSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", values: input, notice: sendNotice };
      }
      const result = await chat.refreshConversation(parsed.data);
      return result.ok
        ? {
            status: "sent",
            values: parsed.data,
            messages: result.data.messages,
            readStates: result.data.readStates,
          }
        : { status: "notice", values: parsed.data, notice: result.notice };
    },

    async loadOlderMessages(input: unknown): Promise<{
      status: "sent" | "notice";
      values: unknown;
      notice?: string;
      messages?: ClientChatMessage[];
      hasMoreOlder?: boolean;
    }> {
      const parsed = loadOlderMessagesSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", values: input, notice: sendNotice };
      }
      const result = await chat.loadOlderMessages(parsed.data);
      return result.ok
        ? {
            status: "sent",
            values: parsed.data,
            messages: result.data.messages,
            hasMoreOlder: result.data.hasMoreOlder,
          }
        : { status: "notice", values: parsed.data, notice: result.notice };
    },

    async backfillMessages(input: unknown): Promise<{
      status: "sent" | "notice";
      values: unknown;
      notice?: string;
      messages?: ClientChatMessage[];
      needsReset?: boolean;
    }> {
      const parsed = backfillMessagesSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", values: input, notice: sendNotice };
      }
      const result = await chat.backfillMessages(parsed.data);
      return result.ok
        ? {
            status: "sent",
            values: parsed.data,
            messages: result.data.messages,
            needsReset: result.data.needsReset,
          }
        : { status: "notice", values: parsed.data, notice: result.notice };
    },

    async loadNewestMessages(input: unknown): Promise<{
      status: "sent" | "notice";
      values: unknown;
      notice?: string;
      messages?: ClientChatMessage[];
      readStates?: ClientChatReadState[];
      hasMoreOlder?: boolean;
      oldestCursor?: { createdAt: string; id: string } | null;
    }> {
      const parsed = loadNewestMessagesSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", values: input, notice: sendNotice };
      }
      const result = await chat.loadNewestMessages(parsed.data);
      return result.ok
        ? {
            status: "sent",
            values: parsed.data,
            messages: result.data.messages,
            readStates: result.data.readStates,
            hasMoreOlder: result.data.hasMoreOlder,
            oldestCursor: result.data.oldestCursor,
          }
        : { status: "notice", values: parsed.data, notice: result.notice };
    },
  };
}

export type ChatActionHandlers = ReturnType<typeof createChatActionHandlers>;
