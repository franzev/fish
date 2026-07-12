import type { CallEvent, CallSessionState, CallState } from "./types";

export const emptyCallSession: CallSessionState = {
  callId: null,
  counterpartId: null,
  counterpartName: null,
  kind: "audio",
  status: "idle",
  direction: null,
  muted: false,
  expiresAt: null,
  connectedAt: null,
  failureReason: null,
};

export function createEmptyCallState(): CallState {
  return { current: { ...emptyCallSession } };
}

export function reduceCallState(state: CallState, event: CallEvent): CallState {
  const current = state.current;

  switch (event.type) {
    case "permissionRequested":
      return {
        current: {
          ...emptyCallSession,
          counterpartId: event.counterpartId,
          counterpartName: event.counterpartName,
          direction: "outgoing",
          status: "requestingPermission",
        },
      };
    case "permissionDenied":
      return {
        current: {
          ...current,
          status: "failed",
          failureReason: event.reason,
        },
      };
    case "outgoingCallCreated":
      return {
        current: {
          ...emptyCallSession,
          callId: event.callId,
          counterpartId: event.counterpartId,
          counterpartName: event.counterpartName,
          direction: "outgoing",
          status: "ringing",
          expiresAt: event.expiresAt,
        },
      };
    case "incomingCallReceived":
      if (isLive(current) && current.callId !== event.callId) return state;
      return {
        current: {
          ...emptyCallSession,
          callId: event.callId,
          counterpartId: event.counterpartId,
          counterpartName: event.counterpartName,
          direction: "incoming",
          status: "ringing",
          expiresAt: event.expiresAt,
        },
      };
    case "callAccepted":
      return forCurrentCall(state, event.callId, (call) => ({
        ...call,
        status: "connecting",
        failureReason: null,
      }));
    case "mediaConnected":
      return forCurrentCall(state, event.callId, (call) => ({
        ...call,
        status: "active",
        connectedAt: call.connectedAt ?? event.connectedAt,
        failureReason: null,
      }));
    case "muteChanged":
      if (!isLive(current)) return state;
      return { current: { ...current, muted: event.muted } };
    case "reconnecting":
      return forCurrentCall(state, event.callId, (call) => ({
        ...call,
        status: call.status === "active" ? "reconnecting" : call.status,
      }));
    case "reconnected":
      return forCurrentCall(state, event.callId, (call) => ({
        ...call,
        status: call.status === "reconnecting" ? "active" : call.status,
      }));
    case "callRejected":
      return terminal(state, event.callId, "rejected");
    case "callCancelled":
      return terminal(state, event.callId, "cancelled");
    case "callMissed":
      return terminal(state, event.callId, "missed");
    case "callEnded":
      return terminal(state, event.callId, "ended");
    case "callFailed":
      if (event.callId && current.callId !== event.callId) return state;
      return {
        current: {
          ...current,
          status: "failed",
          failureReason: event.reason,
        },
      };
    case "clearCall":
    case "identityChanged":
      return createEmptyCallState();
  }
}

function isLive(call: CallSessionState): boolean {
  return [
    "requestingPermission",
    "ringing",
    "connecting",
    "active",
    "reconnecting",
  ].includes(call.status);
}

function forCurrentCall(
  state: CallState,
  callId: string,
  update: (call: CallSessionState) => CallSessionState
): CallState {
  return state.current.callId === callId
    ? { current: update(state.current) }
    : state;
}

function terminal(
  state: CallState,
  callId: string,
  status: "ended" | "rejected" | "cancelled" | "missed"
): CallState {
  return forCurrentCall(state, callId, (call) => ({ ...call, status }));
}

