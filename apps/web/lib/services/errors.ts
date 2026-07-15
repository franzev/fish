export type ServiceErrorCode =
  | "auth"
  | "configuration"
  | "database"
  | "network"
  | "realtime"
  | "storage"
  | "unknown";

export type ServiceFailureReason =
  | "emailNotConfirmed"
  | "invalidCredentials"
  | "userAlreadyExists"
  | "samePassword"
  | "sessionMissing"
  | "weakPassword"
  | "validationFailed"
  | "providerUnavailable";

export interface ServiceErrorInput {
  code: ServiceErrorCode;
  message: string;
  operation?: string;
  recoverable?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export type ServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type ServiceFailure = {
  ok: false;
  error: ServiceError;
};

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

/**
 * All service abstractions surface this one error shape. UI and server actions
 * can branch on `code` without knowing whether the failure came from Supabase,
 * fetch, storage, realtime, or a future third-party provider.
 */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly operation?: string;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(input: ServiceErrorInput) {
    super(input.message);
    this.name = "ServiceError";
    this.code = input.code;
    this.operation = input.operation;
    this.recoverable = input.recoverable ?? false;
    this.details = input.details;
    this.cause = input.cause;
  }
}

export class ServiceConfigurationError extends ServiceError {
  constructor(input: Omit<ServiceErrorInput, "code">) {
    super({ ...input, code: "configuration" });
    this.name = "ServiceConfigurationError";
  }
}

export function serviceSuccess<T>(data: T): ServiceSuccess<T> {
  return { ok: true, data };
}

export function serviceFailure(error: ServiceError): ServiceFailure {
  return { ok: false, error };
}

export function isServiceSuccess<T>(
  result: ServiceResult<T>
): result is ServiceSuccess<T> {
  return result.ok;
}

export function isServiceFailure<T>(
  result: ServiceResult<T>
): result is ServiceFailure {
  return !result.ok;
}

export function normalizeServiceError(
  error: unknown,
  fallback: ServiceErrorInput = {
    code: "unknown",
    message: "The service request failed.",
  }
): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }

  return new ServiceError({
    ...fallback,
    cause: error,
    message:
      fallback.message ||
      (error instanceof Error ? error.message : "The service request failed."),
  });
}

export function mapInfrastructureError(
  error:
    | { message?: string; code?: string; name?: string; status?: number }
    | null
    | undefined,
  input: Omit<ServiceErrorInput, "message" | "details" | "cause"> & {
    fallbackMessage: string;
  }
): ServiceError {
  const reasonByCode: Record<string, ServiceFailureReason> = {
    email_not_confirmed: "emailNotConfirmed",
    invalid_credentials: "invalidCredentials",
    user_already_exists: "userAlreadyExists",
    same_password: "samePassword",
    session_not_found: "sessionMissing",
    weak_password: "weakPassword",
    validation_failed: "validationFailed",
    provider_disabled: "providerUnavailable",
  };
  const reason =
    (error?.code ? reasonByCode[error.code] : undefined) ??
    (error?.name === "AuthSessionMissingError" ? "sessionMissing" : undefined);

  return new ServiceError({
    code: input.code,
    message: error?.message ?? input.fallbackMessage,
    operation: input.operation,
    recoverable: input.recoverable,
    details: {
      ...(reason ? { reason } : {}),
      ...(error?.status ? { status: error.status } : {}),
    },
    cause: error,
  });
}
