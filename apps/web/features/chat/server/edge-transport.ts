import { getServerServices, isLocalBackendUnavailable, postBackendCommand } from "@/lib/services/runtime/server";
import { sendNotice } from "./constants";

export async function getAccessToken(): Promise<string | null> {
  const result = await (await getServerServices()).auth.getAccessToken();
  return result.ok ? result.data : null;
}

export async function postEdgeFunction(
  functionName: "send-message" | "chat-command",
  accessToken: string,
  body: unknown
): Promise<Response> {
  return postBackendCommand(functionName, accessToken, body);
}

export function isLocalEdgeUnavailable(response: Response | null): boolean {
  return isLocalBackendUnavailable(response);
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
