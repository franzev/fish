import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureErrorReporter,
  resetErrorReporterForTests,
} from "./reporter";
import { observeServiceTree } from "./service-observer";

afterEach(() => resetErrorReporterForTests());

describe("service observer", () => {
  it("reports a resolved failure and preserves the original result", async () => {
    const sink = vi.fn();
    const result = { ok: false as const, code: "offline", notice: "Try again" };
    configureErrorReporter(sink);
    const services = observeServiceTree(
      { chat: { send: vi.fn(async () => result) } },
      { prefix: "services", runtime: "browser" }
    );

    await expect(services.chat.send()).resolves.toBe(result);
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0][1]).toMatchObject({
      operation: "services.chat.send",
      handled: true,
      runtime: "browser",
    });
  });

  it("reports a rejected call and rethrows the same error", async () => {
    const sink = vi.fn();
    const error = new Error("network failed");
    configureErrorReporter(sink);
    const services = observeServiceTree(
      { profile: { save: vi.fn(async () => Promise.reject(error)) } },
      { prefix: "services", runtime: "server" }
    );

    await expect(services.profile.save()).rejects.toBe(error);
    expect(sink).toHaveBeenCalledOnce();
  });

  it("preserves method this binding and successful values", async () => {
    const service = {
      value: 7,
      async read() {
        return { ok: true as const, data: this.value };
      },
    };
    const observed = observeServiceTree(service, {
      prefix: "services.counter",
      runtime: "browser",
    });

    await expect(observed.read()).resolves.toEqual({ ok: true, data: 7 });
  });

  it("preserves service behavior when the reporting sink fails", async () => {
    configureErrorReporter(() => {
      throw new Error("reporter unavailable");
    });
    const result = { ok: false as const, code: "offline" };
    const observed = observeServiceTree(
      { read: async () => result },
      { prefix: "services", runtime: "browser" }
    );

    await expect(observed.read()).resolves.toBe(result);
  });
});
