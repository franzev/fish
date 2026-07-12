import { emptyCallSession } from "@fish/core/call-state";
import { describe, expect, it, vi } from "vitest";
import {
  closeCallForNavigation,
  closeFailedMediaConnection,
} from "./call-exit";

function commands() {
  return {
    cancel: vi.fn(async () => ({ ok: false as const, code: "test", notice: "test" })),
    end: vi.fn(async () => ({ ok: false as const, code: "test", notice: "test" })),
    reject: vi.fn(async () => ({ ok: false as const, code: "test", notice: "test" })),
  };
}

describe("closeCallForNavigation", () => {
  it.each([
    ["outgoing ringing", "ringing", "outgoing", "cancel"],
    ["incoming ringing", "ringing", "incoming", "reject"],
    ["connecting", "connecting", "outgoing", "end"],
    ["active", "active", "incoming", "end"],
    ["reconnecting", "reconnecting", "outgoing", "end"],
  ] as const)("closes %s calls with the matching command", async (
    _label,
    status,
    direction,
    expectedCommand
  ) => {
    const callCommands = commands();
    const disconnect = vi.fn();

    await closeCallForNavigation(
      {
        ...emptyCallSession,
        callId: "call-1",
        status,
        direction,
      },
      callCommands,
      disconnect
    );

    expect(disconnect).toHaveBeenCalledOnce();
    expect(callCommands[expectedCommand]).toHaveBeenCalledWith("call-1");
  });

  it("still ends the server call when local media cleanup fails", async () => {
    const callCommands = commands();
    const disconnect = vi.fn(async () => {
      throw new Error("local cleanup failed");
    });

    await closeFailedMediaConnection("call-1", callCommands, disconnect);

    expect(disconnect).toHaveBeenCalledOnce();
    expect(callCommands.end).toHaveBeenCalledWith("call-1");
  });
});
