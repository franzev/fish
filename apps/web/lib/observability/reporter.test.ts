import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureErrorReporter,
  isExpectedOutcome,
  reportFailedResult,
  reportOperationalError,
  resetErrorReporterForTests,
} from "./reporter";

afterEach(() => {
  vi.useRealTimers();
  resetErrorReporterForTests();
});

describe("operational error reporter", () => {
  it("deduplicates the same error object", () => {
    const sink = vi.fn();
    const error = new Error("offline");
    const context = {
      operation: "chat.send",
      handled: true,
      recoverable: true,
    } as const;
    configureErrorReporter(sink);

    reportOperationalError(error, context);
    reportOperationalError(error, context);

    expect(sink).toHaveBeenCalledOnce();
  });

  it.each([
    Object.assign(new Error("cancelled"), { name: "AbortError" }),
    Object.assign(new Error("permission"), { name: "NotAllowedError" }),
    { code: "invalid_credentials" },
    { details: { reason: "validationFailed" } },
  ])("excludes expected outcome %#", (error) => {
    expect(isExpectedOutcome(error)).toBe(true);
  });

  it("reports handled failure results without forwarding notices or payloads", () => {
    const sink = vi.fn();
    configureErrorReporter(sink);

    reportFailedResult(
      {
        ok: false,
        code: "network_unavailable",
        notice: "Private message contents",
        body: "secret",
      },
      { operation: "chat.send", recoverable: true, runtime: "browser" }
    );

    expect(sink).toHaveBeenCalledOnce();
    const [error, context] = sink.mock.calls[0];
    expect(error).toMatchObject({
      message: "Operation failed: chat.send",
      name: "HandledOperationFailure",
    });
    expect(context).toEqual({
      code: "network_unavailable",
      handled: true,
      operation: "chat.send",
      recoverable: true,
      runtime: "browser",
    });
    expect(JSON.stringify([error, context])).not.toContain("Private message");
    expect(JSON.stringify([error, context])).not.toContain("secret");
  });

  it("coalesces a recoverable outage while preserving later reports", () => {
    vi.useFakeTimers();
    const sink = vi.fn();
    configureErrorReporter(sink);

    reportFailedResult(
      { ok: false, code: "CHANNEL_ERROR" },
      { operation: "realtime.calls.subscribe", recoverable: true }
    );
    reportFailedResult(
      { ok: false, code: "CHANNEL_ERROR" },
      { operation: "realtime.attention.subscribe", recoverable: true }
    );

    expect(sink).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(60_000);
    reportFailedResult(
      { ok: false, code: "CHANNEL_ERROR" },
      { operation: "realtime.notifications.subscribe", recoverable: true }
    );

    expect(sink).toHaveBeenCalledTimes(2);
  });

  it("uses and coalesces a service error code when results have no top-level code", () => {
    const sink = vi.fn();
    configureErrorReporter(sink);

    for (const operation of ["notifications.list", "attention.list"]) {
      reportFailedResult(
        { ok: false, error: Object.assign(new Error("Load failed"), {
          code: "network",
        }) },
        { operation, recoverable: true }
      );
    }

    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({
      code: "network",
    }));
  });
});
