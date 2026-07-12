import { getPublicEnv } from "../env";

const localEdgeTimeoutMs = 1_500;

function isLocalBackend(): boolean {
  try {
    const hostname = new URL(getPublicEnv().supabaseUrl).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

export async function postBackendCommand(
  functionName: "send-message" | "chat-command" | "call-command",
  accessToken: string,
  body: unknown
): Promise<Response> {
  const controller = new AbortController();
  const timeout = isLocalBackend() ? setTimeout(() => controller.abort(), localEdgeTimeoutMs) : null;
  try {
    return await fetch(`${getPublicEnv().supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function isLocalBackendUnavailable(response: Response | null): boolean {
  return isLocalBackend() && (!response || [404, 502, 503, 504].includes(response.status));
}
