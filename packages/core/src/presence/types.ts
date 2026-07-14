export type PresencePreference = "automatic" | "away" | "busy" | "invisible";

export type EffectivePresenceStatus =
  | "online"
  | "idle"
  | "away"
  | "busy"
  | "offline";

export interface PresenceSession {
  activeAt: string;
  lastHeartbeatAt: string;
  endedAt?: string | null;
}

export interface PresenceSnapshot {
  userId: string;
  status: EffectivePresenceStatus;
  lastHeartbeatAt: string | null;
  lastSeenAt: string | null;
  revision: number;
  updatedAt: string;
}

export interface DerivedPresence {
  status: EffectivePresenceStatus;
  lastHeartbeatAt: string | null;
  lastSeenAt: string | null;
}
