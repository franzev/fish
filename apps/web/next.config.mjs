import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

const sentryEnabled =
  process.env.NEXT_PUBLIC_SENTRY_ENABLED?.trim().toLowerCase() === "true";

if (sentryEnabled) {
  const requiredSentryEnv = [
    "NEXT_PUBLIC_SENTRY_DSN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN",
  ];
  const missing = requiredSentryEnv.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Sentry is enabled but required build variables are missing: ${missing.join(", ")}.`
    );
  }
}

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      telemetry: false,
      widenClientFileUpload: true,
      webpack: {
        treeshake: {
          removeDebugLogging: true,
          removeTracing: true,
        },
      },
    })
  : nextConfig;
