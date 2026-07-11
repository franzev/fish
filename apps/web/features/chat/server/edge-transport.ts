import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import { getPublicEnv } from "@/lib/services/env";
import { sendNotice } from "./constants";

const localEdgeTimeoutMs = 1_500;

export async function getAccessToken(): Promise<string | null> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return null;
  }

  const { data: sessionData, error: sessionError } =
    await services.client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return null;
  }

  return accessToken;
}

export async function postEdgeFunction(
  functionName: "send-message" | "chat-command",
  accessToken: string,
  body: unknown
): Promise<Response> {
  const controller = new AbortController();
  const timeout = isLocalSupabaseUrl()
    ? setTimeout(() => controller.abort(), localEdgeTimeoutMs)
    : null;

  try {
    return await fetch(`${getPublicEnv().supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function isLocalSupabaseUrl(): boolean {
  try {
    const hostname = new URL(getPublicEnv().supabaseUrl).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

export function isLocalEdgeUnavailable(response: Response | null): boolean {
  return (
    isLocalSupabaseUrl() &&
    (!response || [404, 502, 503, 504].includes(response.status))
  );
}

export function mapChatErrorNotice(
  error: { message?: string } | null | undefined,
  fallback = sendNotice
): string {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("conversation not found")) {
    return "That conversation is not available.";
  }

  if (message.includes("conflicts")) {
    return "That send is already in progress. Try once more.";
  }

  if (message.includes("reply target") || message.includes("message not found")) {
    return "That message is no longer available.";
  }

  if (message.includes("reaction")) {
    return "That reaction is not available.";
  }

  if (message.includes("too long")) {
    return "This message is a little long. Try sending it in two parts.";
  }

  if (message.includes("required")) {
    return "Add a message before sending.";
  }

  return fallback;
}
