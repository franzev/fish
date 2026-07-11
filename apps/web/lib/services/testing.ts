import { serviceSuccess, type ServiceResult } from "./errors";

export function resolvedService<T>(data: T): Promise<ServiceResult<T>> {
  return Promise.resolve(serviceSuccess(data));
}
