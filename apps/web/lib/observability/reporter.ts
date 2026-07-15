export type ErrorRuntime = "browser" | "edge" | "server" | "unknown";

export interface ErrorReportContext {
  operation: string;
  code?: string;
  handled: boolean;
  recoverable?: boolean;
  runtime?: ErrorRuntime;
}

export type ErrorReporter = (
  error: unknown,
  context: ErrorReportContext
) => void;

let reporter: ErrorReporter | null = null;
let reportedErrors = new WeakSet<object>();

const expectedCodes = new Set([
  "abort_error",
  "cancelled",
  "email_not_confirmed",
  "invalid_credentials",
  "not_allowed",
  "validation",
  "validation_failed",
  "weak_password",
]);

const expectedReasons = new Set([
  "emailNotConfirmed",
  "invalidCredentials",
  "userAlreadyExists",
  "validationFailed",
  "weakPassword",
]);

function recordValue(
  value: unknown,
  key: string
): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function normalizedCode(value: unknown): string | undefined {
  return typeof value === "string"
    ? value.trim().replaceAll("-", "_").toLowerCase()
    : undefined;
}

export function isExpectedOutcome(error: unknown): boolean {
  const name = recordValue(error, "name");
  if (
    name === "AbortError" ||
    name === "NotAllowedError" ||
    name === "ZodError"
  ) {
    return true;
  }

  const message = recordValue(error, "message");
  if (
    message === "Image upload cancelled." ||
    message === "Photo upload cancelled."
  ) {
    return true;
  }

  const directReason = recordValue(error, "reason");
  if (directReason === "denied" || directReason === "unavailable") {
    return true;
  }

  const code = normalizedCode(recordValue(error, "code"));
  if (code && expectedCodes.has(code)) return true;

  const details = recordValue(error, "details");
  const reason = recordValue(details, "reason");
  return typeof reason === "string" && expectedReasons.has(reason);
}

export function configureErrorReporter(nextReporter: ErrorReporter | null): void {
  reporter = nextReporter;
}

export function reportOperationalError(
  error: unknown,
  context: ErrorReportContext
): void {
  if (!reporter || isExpectedOutcome(error)) return;

  if (typeof error === "object" && error !== null) {
    if (reportedErrors.has(error)) return;
    reportedErrors.add(error);
  }

  try {
    reporter(error, context);
  } catch {
    // Observability must never change application behavior or recovery paths.
  }
}

export function reportFailedResult(
  result: unknown,
  context: Omit<ErrorReportContext, "handled">
): void {
  if (typeof result !== "object" || result === null) return;
  const value = result as Record<string, unknown>;
  if (value.ok !== false) return;

  const code = normalizedCode(value.code);
  const error = value.error;
  if (error !== undefined) {
    reportOperationalError(error, {
      ...context,
      code: code ?? context.code,
      handled: true,
    });
    return;
  }

  const failure = new Error(`Operation failed: ${context.operation}`);
  failure.name = "HandledOperationFailure";
  if (code) {
    Object.defineProperty(failure, "code", {
      configurable: false,
      enumerable: false,
      value: code,
    });
  }
  reportOperationalError(failure, {
    ...context,
    code: code ?? context.code,
    handled: true,
  });
}

/** Test-only reset for module-global reporting state. */
export function resetErrorReporterForTests(): void {
  reporter = null;
  reportedErrors = new WeakSet<object>();
}
