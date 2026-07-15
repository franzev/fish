import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/observability/environment";
import { sentryOptions } from "@/lib/observability/sentry-options";
import { registerSentryErrorReporter } from "@/lib/observability/sentry-reporter";

if (isSentryEnabled()) {
  Sentry.init(sentryOptions());
  registerSentryErrorReporter();
}
