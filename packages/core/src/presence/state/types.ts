import type {
  PresencePreferenceSetting,
  PresenceSnapshot,
} from "../types";

export interface PendingPresencePreference {
  requestId: string;
  previousSetting: PresencePreferenceSetting;
  optimisticSetting: PresencePreferenceSetting;
}

export interface PresenceState {
  snapshots: Record<string, PresenceSnapshot>;
  preferenceSetting: PresencePreferenceSetting;
  preferenceRevision: number;
  pendingPreference: PendingPresencePreference | null;
}

export type PresenceEvent =
  | { type: "snapshotsHydrated"; snapshots: PresenceSnapshot[] }
  | { type: "snapshotReceived"; snapshot: PresenceSnapshot }
  | { type: "preferenceHydrated"; setting: PresencePreferenceSetting }
  | {
      type: "preferenceChangeReceived";
      setting: PresencePreferenceSetting;
      revision: number;
    }
  | {
      type: "preferenceSetRequested";
      requestId: string;
      setting: PresencePreferenceSetting;
    }
  | {
      type: "preferenceSetSucceeded";
      requestId: string;
      setting: PresencePreferenceSetting;
      snapshot: PresenceSnapshot;
    }
  | { type: "preferenceSetFailed"; requestId: string }
  | { type: "preferenceExpired"; now: string }
  | { type: "reset" };
