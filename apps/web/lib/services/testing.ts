import type { AppServices } from "./contracts";
import { serviceSuccess, type ServiceResult } from "./errors";

export function resolvedService<T>(data: T): Promise<ServiceResult<T>> {
  return Promise.resolve(serviceSuccess(data));
}

/**
 * Minimal test double helper for components/actions that depend on services.
 * Individual tests can override only the methods they exercise.
 */
export function createMockAppServices(
  overrides: Partial<AppServices>
): AppServices {
  return overrides as AppServices;
}

/** @deprecated Prefer createMockAppServices. */
export const createMockSupabaseServices = createMockAppServices;
