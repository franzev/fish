export type CallId = string;
export type CallUserId = string;

export type CallKind = "audio" | "video";
export type CallLifecycleStatus =
  | "idle"
  | "requestingPermission"
  | "ringing"
  | "connecting"
  | "active"
  | "reconnecting"
  | "ended"
  | "rejected"
  | "cancelled"
  | "missed"
  | "failed";

export type CallFailureReason =
  | "permissionDenied"
  | "deviceUnavailable"
  | "connectFailed"
  | "networkLost"
  | "providerUnavailable"
  | "notAllowed";

export interface CallSessionState {
  callId: CallId | null;
  counterpartId: CallUserId | null;
  counterpartName: string | null;
  kind: CallKind;
  status: CallLifecycleStatus;
  direction: "incoming" | "outgoing" | null;
  muted: boolean;
  expiresAt: string | null;
  connectedAt: string | null;
  failureReason: CallFailureReason | null;
}

export interface CallState {
  current: CallSessionState;
}

export type CallEvent =
  | { type: "permissionRequested"; counterpartId: string; counterpartName: string }
  | { type: "permissionDenied"; reason: "permissionDenied" | "deviceUnavailable" }
  | {
      type: "outgoingCallCreated";
      callId: string;
      counterpartId: string;
      counterpartName: string;
      expiresAt: string;
    }
  | {
      type: "incomingCallReceived";
      callId: string;
      counterpartId: string;
      counterpartName: string;
      expiresAt: string;
    }
  | { type: "callAccepted"; callId: string }
  | { type: "mediaConnected"; callId: string; connectedAt: string }
  | { type: "muteChanged"; muted: boolean }
  | { type: "reconnecting"; callId: string }
  | { type: "reconnected"; callId: string }
  | { type: "callRejected"; callId: string }
  | { type: "callCancelled"; callId: string }
  | { type: "callMissed"; callId: string }
  | { type: "callEnded"; callId: string }
  | { type: "callFailed"; callId?: string; reason: CallFailureReason }
  | { type: "clearCall" }
  | { type: "identityChanged" };

