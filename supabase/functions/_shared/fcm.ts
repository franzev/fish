import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import { dispatchDirectMessageApns, dispatchVoipCallApns } from "./apns.ts";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export type CallPush = {
  event: "ringing" | "accepted" | "rejected" | "cancelled" | "ended" | "missed" | "failed";
  callId: string;
  kind: "audio" | "video";
  counterpartId: string;
  counterpartName: string;
  expiresAt: string;
  recipientIds: string[];
};

export type DirectMessagePush = {
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
};

type AndroidDataPush = {
  recipientIds: string[];
  data: Record<string, string>;
  priority: "HIGH" | "NORMAL";
  ttl: string;
  collapseKey: string;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")?.trim();
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ServiceAccount>;
    return value.project_id && value.client_email && value.private_key
      ? value as ServiceAccount
      : null;
  } catch {
    return null;
  }
}

async function accessToken(account: ServiceAccount): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }
  const now = Math.floor(Date.now() / 1_000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3_600,
  }));
  const keyBytes = Uint8Array.from(
    atob(account.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")),
    (character) => character.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) return null;
  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3_600) * 1_000,
  };
  return payload.access_token;
}

function ttlSeconds(expiresAt: string): number {
  const remaining = Math.ceil((Date.parse(expiresAt) - Date.now()) / 1_000);
  return Math.max(1, Math.min(45, Number.isFinite(remaining) ? remaining : 45));
}

function isUnregistered(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  return text.includes("UNREGISTERED") || text.includes("registration-token-not-registered");
}

export async function dispatchCallPush(
  admin: SupabaseClient,
  push: CallPush,
): Promise<void> {
  await Promise.all([
    dispatchAndroidDataPush(admin, {
      recipientIds: push.recipientIds,
      data: {
        version: "1",
        event: push.event,
        callId: push.callId,
        kind: push.kind,
        counterpartId: push.counterpartId,
        counterpartName: push.counterpartName,
        expiresAt: push.expiresAt,
      },
      priority: "HIGH",
      ttl: `${push.event === "ringing" ? ttlSeconds(push.expiresAt) : 45}s`,
      collapseKey: "fish_call",
    }),
    push.event === "ringing"
      ? dispatchVoipCallApns(admin, {
        callId: push.callId,
        kind: push.kind,
        callerId: push.counterpartId,
        callerName: push.counterpartName,
        expiresAt: push.expiresAt,
        recipientIds: push.recipientIds,
      })
      : Promise.resolve(),
  ]);
}

export async function dispatchDirectMessagePush(
  admin: SupabaseClient,
  push: DirectMessagePush,
): Promise<void> {
  await Promise.all([
    dispatchAndroidDataPush(admin, {
      recipientIds: push.recipientIds,
      data: {
        version: "1",
        type: "chat_message",
        conversationId: push.conversationId,
        messageId: push.messageId,
        senderId: push.senderId,
        senderName: push.senderName,
      },
      priority: "HIGH",
      ttl: "604800s",
      collapseKey: `fish_message_${push.conversationId}`,
    }),
    dispatchDirectMessageApns(admin, {
      conversationId: push.conversationId,
      messageId: push.messageId,
      senderName: push.senderName,
      recipientIds: push.recipientIds,
    }),
  ]);
}

async function dispatchAndroidDataPush(
  admin: SupabaseClient,
  push: AndroidDataPush,
): Promise<void> {
  const account = serviceAccount();
  if (!account || push.recipientIds.length === 0) return;
  const bearer = await accessToken(account);
  if (!bearer) return;

  const staleBefore = new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000).toISOString();
  await admin.from("push_devices")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .is("revoked_at", null)
    .eq("platform", "android")
    .eq("push_kind", "standard")
    .lt("last_seen_at", staleBefore);
  const { data: devices, error } = await admin.from("push_devices")
    .select("id, provider_installation_id")
    .in("user_id", push.recipientIds)
    .eq("platform", "android")
    .eq("push_kind", "standard")
    .is("revoked_at", null);
  if (error || !devices?.length) return;

  await Promise.all(devices.map(async (device: { id: string; provider_installation_id: string }) => {
    const request = {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearer}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          fid: device.provider_installation_id,
          data: push.data,
          android: {
            priority: push.priority,
            ttl: push.ttl,
            collapse_key: push.collapseKey,
          },
        },
      }),
    };
    let response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      request,
    );
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        request,
      );
    }
    if (response.ok) return;
    const payload = await response.json().catch(() => null);
    if (response.status === 404 || isUnregistered(payload)) {
      await admin.from("push_devices")
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", device.id);
    }
  }));
}
