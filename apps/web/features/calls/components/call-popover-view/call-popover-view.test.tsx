import { describe, expect, it } from "vitest";
import type { CallSessionState } from "@fish/core/call-state";
import { getCallCopy } from "./call-popover-view";

function call(status: CallSessionState["status"], direction: CallSessionState["direction"] = "outgoing"): CallSessionState {
  return {
    callId: "call-1",
    counterpartId: "coach-1",
    counterpartName: "Coach Mina",
    kind: "video",
    status,
    direction,
    muted: false,
    cameraEnabled: false,
    expiresAt: null,
    connectedAt: null,
    failureReason: null,
  };
}

describe("getCallCopy", () => {
  it.each([
    ["ringing", "Calling Coach Mina"],
    ["connecting", "Connecting with Coach Mina"],
    ["active", "In call with Coach Mina"],
    ["missed", "You missed this call"],
    ["failed", "The call didn’t connect"],
    ["ended", "Call ended"],
  ] as const)("maps %s to calm user-facing copy", (status, heading) => {
    expect(getCallCopy(call(status)).heading).toBe(heading);
  });

  it("uses incoming wording for an incoming ring", () => {
    expect(getCallCopy(call("ringing", "incoming")).heading).toBe("Coach Mina is calling");
  });
});
