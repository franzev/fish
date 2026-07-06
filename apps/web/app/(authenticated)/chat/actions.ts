"use server";

import type { ClientChatMessage } from "@/lib/services";
import { getPublicEnv } from "@/lib/services/env";
import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import { chatLimits } from "@fish/core/chat";
import { z } from "zod";

const sendNotice = "That did not send yet. Keep this open and try again.";

const sendMessageSchema = z.strictObject({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(chatLimits.messageBodyMaxLength),
  clientRequestId: z.string().trim().min(1).max(120),
});

type MessageResponseRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "client" | "coach";
  body: string;
  client_request_id: string;
  created_at: string;
};

export interface SendMessageActionState {
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  message?: ClientChatMessage;
}

function toClientChatMessage(row: MessageResponseRow): ClientChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
  };
}

export async function sendMessageAction(
  input: unknown
): Promise<SendMessageActionState> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  const parsed = sendMessageSchema.safeParse(input);
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
          : "Add a message before sending.",
    };
  }

  const { data: sessionData, error: sessionError } =
    await services.client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return { status: "notice", values: parsed.data, notice: sendNotice };
  }

  const response = await fetch(`${getPublicEnv().supabaseUrl}/functions/v1/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(parsed.data),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: MessageResponseRow | MessageResponseRow[] }
    | null;

  if (!response.ok) {
    return {
      status: "notice",
      values: parsed.data,
      notice: payload?.error ?? sendNotice,
    };
  }

  const message = Array.isArray(payload?.message)
    ? payload?.message[0]
    : payload?.message;

  if (!message) {
    return { status: "notice", values: parsed.data, notice: sendNotice };
  }

  return {
    status: "sent",
    values: parsed.data,
    message: toClientChatMessage(message),
  };
}
