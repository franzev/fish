import type { CallState } from "./types";

export function selectCurrentCall(state: CallState) {
  return state.current;
}

export function selectHasLiveCall(state: CallState): boolean {
  return [
    "requestingPermission",
    "ringing",
    "connecting",
    "active",
    "reconnecting",
  ].includes(state.current.status);
}

export function selectCanMute(state: CallState): boolean {
  return state.current.status === "active" || state.current.status === "reconnecting";
}
