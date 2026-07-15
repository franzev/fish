import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/observability/environment";

export async function register(): Promise<void> {
  if (!isSentryEnabled()) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
