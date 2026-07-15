import * as Sentry from "@sentry/nextjs";
import { configureErrorReporter } from "./reporter";

export function registerSentryErrorReporter(): void {
  configureErrorReporter((error, context) => {
    Sentry.withScope((scope) => {
      scope.setLevel(context.recoverable ? "warning" : "error");
      if (
        context.recoverable &&
        context.code &&
        ["channel_error", "network", "timed_out"].includes(context.code)
      ) {
        scope.setFingerprint(["fish-recoverable-outage", context.code]);
      }
      scope.setTags({
        "fish.error.code": context.code ?? "unknown",
        "fish.error.handled": String(context.handled),
        "fish.error.operation": context.operation,
        "fish.error.recoverable": String(context.recoverable ?? false),
        "fish.error.runtime": context.runtime ?? "unknown",
      });
      Sentry.captureException(
        error instanceof Error
          ? error
          : new Error(`Operation failed: ${context.operation}`)
      );
    });
  });
}
