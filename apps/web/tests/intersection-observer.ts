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

// Targets a test has marked as currently visible via setSentinelIntersecting.
// Real browsers deliver an INITIAL observation the moment an element that is
// already visible starts being observed (or the moment an already-observed
// element becomes visible) — neither the plain Map above nor the manual-only
// triggerIntersection() below can reproduce that, which is exactly the
// coverage hole that let a split-commit re-attachment bug through (see
// .planning/debug/older-load-double-retry.md).
//
// Deliberately NOT cleared by observe()/unobserve()/disconnect(): a real
// element's geometric visibility is independent of which JS observer
// instance (if any) is currently watching it — disconnecting one observer
// and attaching a new one to the same still-visible element delivers a
// fresh initial observation in a real browser. Clearing this set on
// disconnect() would make a re-attached observer silently stop auto-firing,
// which defeats the whole point of this mock: reproducing the gap-commit
// re-attachment bug (disconnect -> re-observe the same still-visible
// sentinel) requires the SAME still-visible sentinel to deliver again.
const intersectingTargets = new Set<Element>();

function deliverInitialObservation(
  target: Element,
  callback: IntersectionCallback
): void {
  // Scheduled on a microtask to mirror the browser's async delivery, and
  // re-checked against the registry when it runs: a disconnect/unobserve
  // (or a new observe() replacing the callback) between scheduling and
  // delivery must silently drop the stale delivery rather than fire into a
  // torn-down observer.
  queueMicrotask(() => {
    if (observedCallbacks.get(target) !== callback) {
      return;
    }

    callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      undefined as unknown as IntersectionObserver
    );
  });
}

export class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private readonly callback: IntersectionCallback) {}

  observe(target: Element): void {
    observedCallbacks.set(target, this.callback);

    if (intersectingTargets.has(target)) {
      deliverInitialObservation(target, this.callback);
    }
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

/** Marks `target` as visible/not-visible for the auto-fire-on-observe path
 *  above — a browser-faithful alternative to triggerIntersection() for tests
 *  that need to prove exactly-once observer behavior across a re-attachment
 *  (e.g. the one-automatic-attempt-after-failure gate). While `target` is
 *  marked intersecting, any observe(target) call auto-delivers an initial
 *  `isIntersecting: true` observation. Calling this with `true` for a target
 *  that is ALREADY observed also delivers an immediate observation — real
 *  browsers fire the callback the moment an observed element becomes
 *  visible, which is how a test delivers "attempt 1" for a sentinel that
 *  did not exist in the DOM until after the component's mount effect had
 *  already called observe(). Existing tests that never call this are
 *  unaffected: observe() stays passive and only triggerIntersection() fires. */
export function setSentinelIntersecting(target: Element, isIntersecting: boolean): void {
  if (!isIntersecting) {
    intersectingTargets.delete(target);
    return;
  }

  intersectingTargets.add(target);

  const callback = observedCallbacks.get(target);
  if (callback) {
    deliverInitialObservation(target, callback);
  }
}

/** Explicit hygiene reset for `setSentinelIntersecting` state. NOT wired
 *  into observe()/unobserve()/disconnect() (see the comment above
 *  intersectingTargets — that would defeat the mock's ability to reproduce
 *  a disconnect-then-re-observe bug). Unnecessary in practice today since
 *  every render() call produces fresh DOM element objects (no cross-test
 *  identity collisions), but available for a suite that reuses target
 *  references across tests and wants a clean slate in afterEach. */
export function resetIntersectingTargets(): void {
  intersectingTargets.clear();
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
