import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureErrorReporter,
  isExpectedOutcome,
  reportFailedResult,
  reportOperationalError,
  resetErrorReporterForTests,
} from "./reporter";

afterEach(() => resetErrorReporterForTests());

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
});
