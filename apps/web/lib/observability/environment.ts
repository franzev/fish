export type ObservabilityEnvSource = Readonly<
  Record<string, string | undefined>
>;

export interface SentryRuntimeEnvironment {
  dsn: string;
  enabled: boolean;
  environment: "staging";
}

/* Keep public variables as direct property accesses so Next.js can inline
   them into instrumentation-client.ts at build time. */
function bundledSentryEnv(): ObservabilityEnvSource {
  return {
    NEXT_PUBLIC_SENTRY_ENABLED: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };
}

export function sentryRuntimeEnvironment(
  source: ObservabilityEnvSource = bundledSentryEnv()
): SentryRuntimeEnvironment {
  const dsn = source.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "";

  return {
    enabled:
      source.NEXT_PUBLIC_SENTRY_ENABLED?.trim().toLowerCase() === "true" &&
      dsn.length > 0,
    dsn,
    environment: "staging",
  };
}

export function isSentryEnabled(
  source: ObservabilityEnvSource = bundledSentryEnv()
): boolean {
  return sentryRuntimeEnvironment(source).enabled;
}
