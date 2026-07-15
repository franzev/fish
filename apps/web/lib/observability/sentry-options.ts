import { sentryRuntimeEnvironment } from "./environment";
import {
  sanitizeBreadcrumb,
  sanitizeSentryEvent,
} from "./sentry-privacy";

export function sentryOptions() {
  const environment = sentryRuntimeEnvironment();
  return {
    attachStacktrace: true,
    beforeBreadcrumb: sanitizeBreadcrumb,
    beforeSend: sanitizeSentryEvent,
    dsn: environment.dsn,
    enableLogs: false,
    enabled: environment.enabled,
    environment: environment.environment,
    maxBreadcrumbs: 50,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    sampleRate: 1,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  };
}
