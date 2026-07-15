import {
  reportFailedResult,
  reportOperationalError,
  type ErrorRuntime,
} from "./reporter";

type ServiceMethod = (...args: unknown[]) => unknown;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export function observeServiceTree<T extends object>(
  services: T,
  options: { prefix: string; runtime: ErrorRuntime }
): T {
  const objectCache = new WeakMap<object, object>();
  const methodCache = new WeakMap<object, Map<PropertyKey, ServiceMethod>>();

  function inspectResult(value: unknown, operation: string): unknown {
    reportFailedResult(value, {
      operation,
      recoverable: true,
      runtime: options.runtime,
    });
    return value;
  }

  function observeObject(target: object, path: string): object {
    const cached = objectCache.get(target);
    if (cached) return cached;

    const proxy = new Proxy(target, {
      get(currentTarget, property) {
        const value = Reflect.get(currentTarget, property, currentTarget);
        if (typeof property === "symbol") return value;
        const operation = `${path}.${property}`;

        if (typeof value === "function") {
          const method = value as ServiceMethod;
          const targetMethods = methodCache.get(currentTarget) ?? new Map();
          methodCache.set(currentTarget, targetMethods);
          const cachedMethod = targetMethods.get(property);
          if (cachedMethod) return cachedMethod;

          const observedMethod = (...args: unknown[]) => {
            try {
              const result = Reflect.apply(method, currentTarget, args);
              if (!isPromiseLike(result)) {
                return inspectResult(result, operation);
              }

              return Promise.resolve(result).then(
                (resolved) => inspectResult(resolved, operation),
                (error) => {
                  reportOperationalError(error, {
                    operation,
                    handled: true,
                    recoverable: false,
                    runtime: options.runtime,
                  });
                  throw error;
                }
              );
            } catch (error) {
              reportOperationalError(error, {
                operation,
                handled: true,
                recoverable: false,
                runtime: options.runtime,
              });
              throw error;
            }
          };

          targetMethods.set(property, observedMethod);
          return observedMethod;
        }

        if (typeof value === "object" && value !== null) {
          return observeObject(value, operation);
        }
        return value;
      },
    });

    objectCache.set(target, proxy);
    return proxy;
  }

  return observeObject(services, options.prefix) as T;
}
