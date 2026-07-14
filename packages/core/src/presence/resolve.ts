import type {
  DerivedPresence,
  PresencePreference,
  PresenceSession,
} from "./types";

export const PRESENCE_HEARTBEAT_MS = 30_000;
export const PRESENCE_STALE_MS = 90_000;
export const PRESENCE_IDLE_MS = 5 * 60_000;

function validTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function resolvePresence(
  sessions: PresenceSession[],
  preference: PresencePreference,
  now: Date = new Date()
): DerivedPresence {
  if (preference === "invisible") {
    return {
      status: "offline",
      lastHeartbeatAt: null,
      lastSeenAt: null,
    };
  }

  const nowMs = now.getTime();
  let latestHeartbeat: number | null = null;
  let latestSeen: number | null = null;
  let connected = false;
  let active = false;

  for (const session of sessions) {
    const heartbeat = validTime(session.lastHeartbeatAt);
    const activeAt = validTime(session.activeAt);
    const endedAt = validTime(session.endedAt);
    if (heartbeat !== null) {
      latestHeartbeat = Math.max(latestHeartbeat ?? heartbeat, heartbeat);
      latestSeen = Math.max(latestSeen ?? heartbeat, heartbeat, endedAt ?? heartbeat);
    }

    const fresh =
      session.endedAt == null &&
      heartbeat !== null &&
      heartbeat >= nowMs - PRESENCE_STALE_MS;
    connected ||= fresh;
    active ||=
      fresh && activeAt !== null && activeAt >= nowMs - PRESENCE_IDLE_MS;
  }

  const lastHeartbeatAt =
    latestHeartbeat === null ? null : new Date(latestHeartbeat).toISOString();
  const lastSeenAt = latestSeen === null ? null : new Date(latestSeen).toISOString();

  if (!connected) {
    return { status: "offline", lastHeartbeatAt, lastSeenAt };
  }
  if (preference === "away" || preference === "busy") {
    return { status: preference, lastHeartbeatAt, lastSeenAt };
  }
  return {
    status: active ? "online" : "idle",
    lastHeartbeatAt,
    lastSeenAt,
  };
}
