import type { CallEvent, CallState } from "@fish/core/call-state";
import type { ClientCall } from "@/lib/services";

export interface CallPlanContext {
  userId?: string;
  counterpartName?: string;
}

export interface CallEventPlan {
  events: CallEvent[];
  shouldDisconnect: boolean;
}

export function planCallEvents(
  call: ClientCall,
  state: CallState,
  context: CallPlanContext = {}
): CallEventPlan {
  const current = state.current;
  const counterpartId =
    current.counterpartId ??
    (call.initiatedBy === call.coachId ? call.clientId : call.coachId);
  const counterpartName = current.counterpartName ?? context.counterpartName ?? "";
  const outgoing = context.userId
    ? call.initiatedBy === context.userId
    : current.direction === "outgoing";
  const identityEvent: CallEvent = {
    type: outgoing ? "outgoingCallCreated" : "incomingCallReceived",
    callId: call.id,
    counterpartId,
    counterpartName,
    kind: call.kind,
    expiresAt: call.expiresAt,
  };
  const needsIdentity = current.callId !== call.id;

  if (call.status === "ringing") {
    return {
      events: [identityEvent],
      shouldDisconnect: false,
    };
  }

  if (call.status === "connecting" || call.status === "active") {
    const events: CallEvent[] = needsIdentity ? [identityEvent] : [];
    events.push({ type: "callAccepted", callId: call.id });
    if (call.status === "active") {
      events.push({
        type: "mediaConnected",
        callId: call.id,
        connectedAt: call.connectedAt ?? new Date().toISOString(),
      });
    }
    return { events, shouldDisconnect: false };
  }

  const terminalEvent: CallEvent =
    call.status === "rejected"
      ? { type: "callRejected", callId: call.id }
      : call.status === "cancelled"
        ? { type: "callCancelled", callId: call.id }
        : call.status === "missed"
          ? { type: "callMissed", callId: call.id }
          : call.status === "ended"
            ? { type: "callEnded", callId: call.id }
            : { type: "callFailed", callId: call.id, reason: "connectFailed" };

  return {
    events: [...(needsIdentity ? [identityEvent] : []), terminalEvent],
    shouldDisconnect: true,
  };
}
