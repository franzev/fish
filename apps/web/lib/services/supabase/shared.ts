import {
  mapInfrastructureError,
  normalizeServiceError,
  serviceFailure,
  type ServiceResult,
} from "@/lib/services/errors";
import type { ServiceErrorCode } from "@/lib/services/errors";

export const mapSupabaseError = mapInfrastructureError;

export function failWith<T = never>(
  operation: string,
  fallbackMessage: string,
  code: ServiceErrorCode = "database"
) {
  return (error: unknown): ServiceResult<T> => serviceFailure(
    mapSupabaseError(error as { message?: string; code?: string } | null, {
      code,
      fallbackMessage,
      operation,
      recoverable: true,
    })
  );
}

export type SupabaseResponse<T> = {
  data: T | null;
  error: { message?: string; code?: string; name?: string; status?: number } | null;
};
export async function safely<T>(
  operation: string,
  run: () => Promise<ServiceResult<T>>
): Promise<ServiceResult<T>> {
  try {
    return await run();
  } catch (error) {
    return serviceFailure(
      normalizeServiceError(error, {
        code: "unknown",
        message: "The service request failed.",
        operation,
      })
    );
  }
}
