import { describe, expect, it } from "vitest";
import { isSentryEnabled, sentryRuntimeEnvironment } from "./environment";

describe("Sentry environment gate", () => {
  it("enables staging only when the explicit flag and DSN are both present", () => {
    expect(
      sentryRuntimeEnvironment({
        NEXT_PUBLIC_SENTRY_ENABLED: " true ",
        NEXT_PUBLIC_SENTRY_DSN: " https://public@sentry.example/1 ",
      })
    ).toEqual({
      dsn: "https://public@sentry.example/1",
      enabled: true,
      environment: "staging",
    });
  });

  it.each([
    {},
    { NEXT_PUBLIC_SENTRY_ENABLED: "false", NEXT_PUBLIC_SENTRY_DSN: "dsn" },
    { NEXT_PUBLIC_SENTRY_ENABLED: "true" },
  ])("stays disabled for local and production-style config %#", (source) => {
    expect(isSentryEnabled(source)).toBe(false);
  });
});
