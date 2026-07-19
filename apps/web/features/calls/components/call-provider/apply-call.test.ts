import { describe, expect, it } from "vitest";
import type { CallState } from "@fish/core/call-state";
import type { ClientCall } from "@/lib/services";
import { planCallEvents } from "./apply-call";

const baseCall: ClientCall = {
  id: "call-1",
  lessonSlotId: null,
  coachId: "coach-1",
  clientId: "client-1",
  initiatedBy: "client-1",
  kind: "video",
  status: "ringing",
  expiresAt: "2030-01-01T00:00:00.000Z",
  acceptedAt: null,
  connectedAt: null,
  endedAt: null,
  endReason: null,
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z",
};
const emptyState: CallState = {
  current: {
    callId: null,
    counterpartId: null,
    counterpartName: null,
    kind: "audio",
    status: "idle",
    direction: null,
    muted: false,
    cameraEnabled: false,
    expiresAt: null,
    connectedAt: null,
    failureReason: null,
  },
};

describe("planCallEvents", () => {
  it.each([
    ["ringing", ["outgoingCallCreated", "ringing"], false],
    ["connecting", ["outgoingCallCreated", "callAccepted"], false],
    ["active", ["outgoingCallCreated", "callAccepted", "mediaConnected"], false],
    ["ended", ["outgoingCallCreated", "callEnded"], true],
  ] as const)("plans %s snapshots", (status, eventTypes, shouldDisconnect) => {
    const plan = planCallEvents(
      { ...baseCall, status },
      emptyState,
      { userId: "client-1", counterpartName: "Coach" }
    );
    expect(plan.events.map((event) => event.type)).toEqual(
      eventTypes.filter((type) => type !== "ringing")
    );
    expect(plan.shouldDisconnect).toBe(shouldDisconnect);
  });

  it("does not re-create the identity for an already tracked call", () => {
    const state = {
      ...emptyState,
      current: {
        ...emptyState.current,
        callId: "call-1",
        direction: "incoming" as const,
        counterpartId: "client-1",
        counterpartName: "Client",
      },
    };
    expect(planCallEvents({ ...baseCall, status: "active" }, state).events.map((event) => event.type)).toEqual([
      "callAccepted",
      "mediaConnected",
    ]);
  });
});
