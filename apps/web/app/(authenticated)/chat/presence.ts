import {
  formatTimeOfDay,
  type TimeFormatPref,
} from "@/lib/prefs/time-format";

export interface PresenceSnapshot {
  online: boolean;
  activeNow: boolean;
  lastSeenAt: string | null;
}

export interface PresenceStatus {
  label: string;
  showOnlineDot: boolean;
}

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isYesterday(date: Date, now: Date): boolean {
  const today = startOfLocalDay(now).getTime();
  const target = startOfLocalDay(date).getTime();
  return today - target === dayMs;
}

function formatCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelativeLastSeen(lastSeen: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - lastSeen.getTime());

  if (elapsed < hourMs) {
    const minutes = Math.max(1, Math.floor(elapsed / minuteMs));
    return `Last seen ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  if (elapsed < dayMs && !isYesterday(lastSeen, now)) {
    const hours = Math.max(1, Math.floor(elapsed / hourMs));
    return `Last seen ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  return "";
}

export function formatPresenceStatus(
  presence: PresenceSnapshot,
  now: Date = new Date(),
  timeFormatPref: TimeFormatPref = null
): PresenceStatus {
  if (presence.online && presence.activeNow) {
    return { label: "Active now", showOnlineDot: true };
  }

  if (presence.online) {
    return { label: "Online", showOnlineDot: true };
  }

  const lastSeen = presence.lastSeenAt ? new Date(presence.lastSeenAt) : null;
  if (!lastSeen || Number.isNaN(lastSeen.getTime())) {
    return { label: "Offline", showOnlineDot: false };
  }

  const relative = formatRelativeLastSeen(lastSeen, now);
  if (relative) {
    return { label: relative, showOnlineDot: false };
  }

  if (isYesterday(lastSeen, now)) {
    return {
      label: `Last seen yesterday at ${formatTimeOfDay(
        lastSeen,
        timeFormatPref
      )}`,
      showOnlineDot: false,
    };
  }

  return {
    label: `Last seen on ${formatCalendarDate(lastSeen)}`,
    showOnlineDot: false,
  };
}

export function derivePresenceSnapshot(
  sessions: Array<{
    activeAt: string;
    lastHeartbeatAt: string;
    endedAt?: string | null;
  }>,
  now: Date = new Date()
): PresenceSnapshot {
  const onlineCutoff = now.getTime() - 45_000;
  const activeCutoff = now.getTime() - 20_000;
  let lastSeenAt: string | null = null;
  let online = false;
  let activeNow = false;

  for (const session of sessions) {
    const heartbeat = new Date(session.lastHeartbeatAt);
    const active = new Date(session.activeAt);
    const ended = session.endedAt ? new Date(session.endedAt) : null;
    const seenAt = ended && ended.getTime() > heartbeat.getTime() ? ended : heartbeat;

    if (!Number.isNaN(seenAt.getTime())) {
      if (!lastSeenAt || Date.parse(lastSeenAt) < seenAt.getTime()) {
        lastSeenAt = seenAt.toISOString();
      }
    }

    const sessionOnline =
      !ended && !Number.isNaN(heartbeat.getTime()) && heartbeat.getTime() >= onlineCutoff;
    online = online || sessionOnline;
    activeNow =
      activeNow ||
      (sessionOnline &&
        !Number.isNaN(active.getTime()) &&
        active.getTime() >= activeCutoff);
  }

  return { online, activeNow, lastSeenAt };
}
