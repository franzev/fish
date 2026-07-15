import { afterEach, describe, expect, it, vi } from "vitest";
import {
  reportFailedResult,
  resetErrorReporterForTests,
} from "./reporter";

type SentryScopeMock = {
  setFingerprint: ReturnType<typeof vi.fn>;
  setLevel: ReturnType<typeof vi.fn>;
  setTags: ReturnType<typeof vi.fn>;
};

const sentry = vi.hoisted(() => {
  const scope: SentryScopeMock = {
    setFingerprint: vi.fn(),
    setLevel: vi.fn(),
    setTags: vi.fn(),
  };
  return {
    captureException: vi.fn(),
    scope,
    withScope: vi.fn((callback: (scope: SentryScopeMock) => void) => {
      callback(scope);
    }),
  };
});

vi.mock("@sentry/nextjs", () => sentry);

import { registerSentryErrorReporter } from "./sentry-reporter";

afterEach(() => {
  resetErrorReporterForTests();
  vi.clearAllMocks();
});

describe("registerSentryErrorReporter", () => {
  it("groups recoverable outage reports by normalized code", () => {
    registerSentryErrorReporter();

    reportFailedResult(
      { ok: false, code: "CHANNEL_ERROR" },
      {
        operation: "realtime.attention.subscribe",
        recoverable: true,
        runtime: "browser",
      }
    );

    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      "fish-recoverable-outage",
      "channel_error",
    ]);
    expect(sentry.captureException).toHaveBeenCalledOnce();
  });
});
