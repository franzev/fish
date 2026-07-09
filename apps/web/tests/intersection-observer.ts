// jsdom does not implement IntersectionObserver. This is the SINGLE shared
// module that owns both the mock class and the trigger helper so they share
// one callback registry (a Map living in vitest.setup.ts could not be reached
// by a helper defined in a separate file — review MEDIUM 10-04). Capture-and-
// trigger shape lets a sentinel test fire `isIntersecting: true` deliberately,
// instead of relying on a real scroll/layout to cross the observer threshold.
type IntersectionCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver
) => void;

const observedCallbacks = new Map<Element, IntersectionCallback>();

export class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private readonly callback: IntersectionCallback) {}

  observe(target: Element): void {
    observedCallbacks.set(target, this.callback);
  }

  unobserve(target: Element): void {
    observedCallbacks.delete(target);
  }

  disconnect(): void {
    observedCallbacks.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** Installs the mock onto `globalThis.IntersectionObserver` when the runtime
 *  (jsdom) has none — call once from vitest.setup.ts. */
export function installIntersectionObserverMock(): void {
  if (typeof globalThis.IntersectionObserver === "undefined") {
    globalThis.IntersectionObserver =
      IntersectionObserverMock as unknown as typeof IntersectionObserver;
  }
}

/** Simulates the sentinel entering/leaving the viewport by invoking the
 *  callback stored for `target` in the shared registry. */
export function triggerIntersection(target: Element, isIntersecting: boolean): void {
  const callback = observedCallbacks.get(target);
  if (!callback) {
    return;
  }

  callback(
    [{ isIntersecting, target } as IntersectionObserverEntry],
    undefined as unknown as IntersectionObserver
  );
}
