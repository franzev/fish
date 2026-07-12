import {
  createEmptyCallState,
  reduceCallState,
} from "@fish/core/call-state";
import { describe, expect, it } from "vitest";

describe("portable call state", () => {
  it("moves an outgoing call through ringing, connecting, and active", () => {
    const ringing = reduceCallState(createEmptyCallState(), {
      type: "outgoingCallCreated",
      callId: "call-1",
      counterpartId: "coach-1",
      counterpartName: "Coach Mina",
      kind: "video",
      expiresAt: "2026-07-12T10:00:45.000Z",
    });
    const connecting = reduceCallState(ringing, {
      type: "callAccepted",
      callId: "call-1",
    });
    const active = reduceCallState(connecting, {
      type: "mediaConnected",
      callId: "call-1",
      connectedAt: "2026-07-12T10:00:04.000Z",
    });

    expect(ringing.current).toMatchObject({
      status: "ringing",
      direction: "outgoing",
      kind: "video",
    });
    expect(connecting.current.status).toBe("connecting");
    expect(active.current.status).toBe("active");
    expect(
      reduceCallState(active, { type: "cameraChanged", enabled: true }).current
        .cameraEnabled
    ).toBe(true);
  });

  it("ignores stale call events and clears state on identity change", () => {
    const active = reduceCallState(
      reduceCallState(createEmptyCallState(), {
        type: "incomingCallReceived",
        callId: "call-1",
        counterpartId: "client-1",
        counterpartName: "Ari",
        kind: "audio",
        expiresAt: "2026-07-12T10:00:45.000Z",
      }),
      { type: "callAccepted", callId: "call-1" }
    );

    expect(
      reduceCallState(active, { type: "callEnded", callId: "stale-call" })
    ).toBe(active);
    expect(
      reduceCallState(active, { type: "identityChanged" }).current.status
    ).toBe("idle");
  });
});
