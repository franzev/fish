import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureRequestErrorMock, initMock, registerReporterMock } = vi.hoisted(
  () => ({
    captureRequestErrorMock: vi.fn(),
    initMock: vi.fn(),
    registerReporterMock: vi.fn(),
  })
);

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: captureRequestErrorMock,
  init: initMock,
  withScope: vi.fn(),
}));

vi.mock("@/lib/observability/sentry-reporter", () => ({
  registerSentryErrorReporter: registerReporterMock,
}));

describe("Next.js Sentry instrumentation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SENTRY_ENABLED = "true";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.example/1";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SENTRY_ENABLED;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.NEXT_RUNTIME;
  });

  it.each(["nodejs", "edge"] as const)(
    "initializes the %s runtime and registers the reporter",
    async (runtime) => {
      process.env.NEXT_RUNTIME = runtime;
      const instrumentation = await import("./instrumentation");

      await instrumentation.register();

      expect(initMock).toHaveBeenCalledOnce();
      expect(initMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: "https://public@sentry.example/1",
          enabled: true,
          environment: "staging",
          replaysSessionSampleRate: 0,
          tracesSampleRate: 0,
        })
      );
      expect(registerReporterMock).toHaveBeenCalledOnce();
      expect(instrumentation.onRequestError).toBe(captureRequestErrorMock);
    }
  );

  it("does not initialize any runtime when staging monitoring is disabled", async () => {
    process.env.NEXT_PUBLIC_SENTRY_ENABLED = "false";
    process.env.NEXT_RUNTIME = "nodejs";
    const instrumentation = await import("./instrumentation");

    await instrumentation.register();

    expect(initMock).not.toHaveBeenCalled();
    expect(registerReporterMock).not.toHaveBeenCalled();
  });
});
