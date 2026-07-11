import {
  normalizeServiceError,
  serviceFailure,
  type ServiceResult,
} from "@/lib/services/errors";

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
