export type ServiceMap = Record<string, unknown>;

export type ServiceContainer<TServices extends ServiceMap> = Readonly<TServices>;

/**
 * Tiny DI container: the app imports concrete factories at the runtime edge,
 * then passes this immutable service map into actions/components/helpers that
 * should depend on interfaces instead of constructing third-party clients.
 */
export function createServiceContainer<TServices extends ServiceMap>(
  services: TServices
): ServiceContainer<TServices> {
  return Object.freeze({ ...services });
}

export function extendServiceContainer<
  TBase extends ServiceMap,
  TExtension extends ServiceMap,
>(
  base: ServiceContainer<TBase>,
  extension: TExtension
): ServiceContainer<TBase & TExtension> {
  return Object.freeze({ ...base, ...extension }) as ServiceContainer<
    TBase & TExtension
  >;
}
