import type {
  EffectivePresenceStatus,
  PresenceSnapshot,
} from "@fish/core/presence";
import {
  formatTimeOfDay,
  type TimeFormatPref,
} from "@/lib/prefs/time-format";

export type PresenceDisplayStatus = EffectivePresenceStatus | "invisible";

export const presenceLabels: Record<PresenceDisplayStatus, string> = {
  online: "Online",
  idle: "Idle",
  away: "Away",
  busy: "Busy",
  invisible: "Invisible",
  offline: "Offline",
};

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatLastSeen(
  value: string,
  now: Date,
  timeFormatPref: TimeFormatPref
): string | null {
  const seen = new Date(value);
  if (Number.isNaN(seen.getTime())) return null;
  const elapsed = Math.max(0, now.getTime() - seen.getTime());
  if (elapsed < hourMs) {
    const minutes = Math.max(1, Math.floor(elapsed / minuteMs));
    return `Last seen ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (elapsed < dayMs && startOfLocalDay(seen) === startOfLocalDay(now)) {
    const hours = Math.max(1, Math.floor(elapsed / hourMs));
    return `Last seen ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (startOfLocalDay(now) - startOfLocalDay(seen) === dayMs) {
    return `Last seen yesterday at ${formatTimeOfDay(seen, timeFormatPref)}`;
  }
  return `Last seen on ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(seen)}`;
}

export function getPresencePresentation(
  snapshot: PresenceSnapshot | null,
  now: Date,
  timeFormatPref: TimeFormatPref = null
) {
  const heartbeat = snapshot?.lastHeartbeatAt
    ? Date.parse(snapshot.lastHeartbeatAt)
    : Number.NaN;
  const stale =
    snapshot?.status !== "offline" &&
    (Number.isNaN(heartbeat) || heartbeat < now.getTime() - 90_000);
  const status: EffectivePresenceStatus = stale
    ? "offline"
    : snapshot?.status ?? "offline";
  const detail = status === "offline" && snapshot?.lastSeenAt
    ? formatLastSeen(snapshot.lastSeenAt, now, timeFormatPref)
    : null;
  return { status, label: presenceLabels[status], detail };
}
