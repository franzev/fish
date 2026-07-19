import type { PresenceSnapshot } from "../types";
import type { PresenceState } from "./types";

export function selectPresenceSnapshots(
  state: PresenceState
): ReadonlyMap<string, PresenceSnapshot> {
  return new Map(Object.entries(state.snapshots));
}

export function selectPresenceSnapshot(
  state: PresenceState,
  userId: string
): PresenceSnapshot | null {
  return state.snapshots[userId] ?? null;
}

export function selectPresencePreference(state: PresenceState) {
  return state.preferenceSetting;
}

export function selectPresenceIsChanging(state: PresenceState): boolean {
  return state.pendingPreference !== null;
}
