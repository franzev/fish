import type {
  PresencePreferenceSetting,
  PresenceSnapshot,
} from "../types";
import type {
  PendingPresencePreference,
  PresenceEvent,
  PresenceState,
} from "./types";

const automaticSetting: PresencePreferenceSetting = {
  preference: "automatic",
  expiresAt: null,
};

export function createInitialPresenceState(): PresenceState {
  return {
    snapshots: {},
    preferenceSetting: automaticSetting,
    preferenceRevision: 0,
    pendingPreference: null,
  };
}

function mergeSnapshot(
  snapshots: Record<string, PresenceSnapshot>,
  snapshot: PresenceSnapshot
): Record<string, PresenceSnapshot> {
  const previous = snapshots[snapshot.userId];
  if (previous && previous.revision >= snapshot.revision) return snapshots;
  return { ...snapshots, [snapshot.userId]: snapshot };
}

function shouldRestoreOptimisticSetting(
  state: PresenceState,
  pending: PendingPresencePreference
): boolean {
  return (
    state.preferenceSetting.preference === pending.optimisticSetting.preference &&
    state.preferenceSetting.expiresAt === pending.optimisticSetting.expiresAt
  );
}

export function reducePresenceState(
  state: PresenceState,
  event: PresenceEvent
): PresenceState {
  switch (event.type) {
    case "snapshotsHydrated":
      return {
        ...state,
        snapshots: event.snapshots.reduce((next, snapshot) => {
          const previous = state.snapshots[snapshot.userId];
          next[snapshot.userId] =
            previous && previous.revision >= snapshot.revision
              ? previous
              : snapshot;
          return next;
        }, {} as Record<string, PresenceSnapshot>),
      };
    case "snapshotReceived":
      return {
        ...state,
        snapshots: mergeSnapshot(state.snapshots, event.snapshot),
      };
    case "preferenceHydrated":
      if (state.preferenceRevision !== 0 || state.pendingPreference) return state;
      return { ...state, preferenceSetting: event.setting };
    case "preferenceChangeReceived":
      if (event.revision < state.preferenceRevision) return state;
      return {
        ...state,
        preferenceSetting: event.setting,
        preferenceRevision: event.revision,
      };
    case "preferenceSetRequested":
      return {
        ...state,
        preferenceSetting: event.setting,
        pendingPreference: {
          requestId: event.requestId,
          previousSetting: state.preferenceSetting,
          optimisticSetting: event.setting,
        },
      };
    case "preferenceSetSucceeded":
      return {
        ...state,
        snapshots: mergeSnapshot(state.snapshots, event.snapshot),
        preferenceSetting: event.setting,
        preferenceRevision: Math.max(
          state.preferenceRevision,
          event.snapshot.revision
        ),
        pendingPreference:
          state.pendingPreference?.requestId === event.requestId
            ? null
            : state.pendingPreference,
      };
    case "preferenceSetFailed": {
      const pending = state.pendingPreference;
      if (!pending || pending.requestId !== event.requestId) return state;
      return {
        ...state,
        preferenceSetting: shouldRestoreOptimisticSetting(state, pending)
          ? pending.previousSetting
          : state.preferenceSetting,
        pendingPreference: null,
      };
    }
    case "preferenceExpired": {
      const expiresAt = state.preferenceSetting.expiresAt;
      if (!expiresAt || Date.parse(expiresAt) > Date.parse(event.now)) {
        return state;
      }
      return {
        ...state,
        preferenceSetting: automaticSetting,
      };
    }
    case "reset":
      return createInitialPresenceState();
  }
}
