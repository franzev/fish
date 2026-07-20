import { importPKCS8, SignJWT } from "npm:jose@6.0.11";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";

type ApnsCredentials = {
  teamId: string;
  keyId: string;
  privateKey: string;
  topic: string;
  endpoint: string;
};

export type DirectMessageApnsPush = {
  conversationId: string;
  messageId: string;
  senderName: string;
  recipientIds: string[];
};

let cachedProviderToken: { value: string; expiresAt: number } | null = null;

function credentials(): ApnsCredentials | null {
  const teamId = Deno.env.get("APNS_TEAM_ID")?.trim();
  const keyId = Deno.env.get("APNS_KEY_ID")?.trim();
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY")?.trim();
  const topic = Deno.env.get("APNS_BUNDLE_ID")?.trim();
  if (!teamId || !keyId || !privateKey || !topic) return null;
  return {
    teamId,
    keyId,
    privateKey: privateKey.replaceAll("\\n", "\n"),
    topic,
    endpoint: Deno.env.get("APNS_ENDPOINT")?.trim() ||
      "https://api.push.apple.com",
  };
}

async function providerToken(config: ApnsCredentials): Promise<string | null> {
  if (
    cachedProviderToken && cachedProviderToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedProviderToken.value;
  }
  try {
    const key = await importPKCS8(config.privateKey, "ES256");
    const value = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: config.keyId })
      .setIssuer(config.teamId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    cachedProviderToken = { value, expiresAt: Date.now() + 50 * 60 * 1_000 };
    return value;
  } catch {
    return null;
  }
}

function shouldRevoke(status: number, payload: unknown): boolean {
  if (status === 410) return true;
  const reason =
    typeof payload === "object" && payload !== null && "reason" in payload
      ? (payload as { reason?: unknown }).reason
      : null;
  return reason === "BadDeviceToken" || reason === "Unregistered";
}

export async function dispatchDirectMessageApns(
  admin: SupabaseClient,
  push: DirectMessageApnsPush,
): Promise<void> {
  const config = credentials();
  if (!config || push.recipientIds.length === 0) return;
  const bearer = await providerToken(config);
  if (!bearer) return;

  const staleBefore = new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000)
    .toISOString();
  await admin.from("push_devices")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .is("revoked_at", null)
    .eq("platform", "ios")
    .lt("last_seen_at", staleBefore);
  const { data: devices, error } = await admin.from("push_devices")
    .select("id, provider_installation_id")
    .in("user_id", push.recipientIds)
    .eq("platform", "ios")
    .is("revoked_at", null);
  if (error || !devices?.length) return;

  await Promise.all(
    devices.map(
      async (device: { id: string; provider_installation_id: string }) => {
        const body = JSON.stringify({
          aps: {
            alert: {
              title: push.senderName,
              body: "New message",
            },
            sound: "default",
            "thread-id": `fish-message-${push.conversationId}`,
          },
          type: "chat_message",
          conversationId: push.conversationId,
          messageId: push.messageId,
        });
        const request = {
          method: "POST",
          headers: {
            authorization: `bearer ${bearer}`,
            "apns-topic": config.topic,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
          },
          body,
        };
        const url = `${
          config.endpoint.replace(/\/$/, "")
        }/3/device/${device.provider_installation_id}`;
        let response = await fetch(url, request);
        if (
          !response.ok && (response.status === 429 || response.status >= 500)
        ) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          response = await fetch(url, request);
        }
        if (response.ok) return;
        const payload = await response.json().catch(() => null);
        if (shouldRevoke(response.status, payload)) {
          await admin.from("push_devices")
            .update({
              revoked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", device.id);
        }
      },
    ),
  );
}
