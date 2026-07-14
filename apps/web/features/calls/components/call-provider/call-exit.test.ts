import { describe, expect, it, vi } from "vitest";
import { closeFailedMediaConnection } from "./call-exit";

function commands() {
  return {
    end: vi.fn(async () => ({ ok: false as const, code: "test", notice: "test" })),
  };
}

describe("closeFailedMediaConnection", () => {
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
