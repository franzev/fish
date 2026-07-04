import type { SupabaseServices } from "./supabase/types";
import { serviceSuccess, type ServiceResult } from "./errors";

export function resolvedService<T>(data: T): Promise<ServiceResult<T>> {
  return Promise.resolve(serviceSuccess(data));
}

/**
 * Minimal test double helper for components/actions that depend on services.
 * Individual tests can override only the methods they exercise.
 */
export function createMockSupabaseServices(
  overrides: Partial<SupabaseServices>
): SupabaseServices {
  return overrides as SupabaseServices;
}
