import "@testing-library/jest-dom/vitest";
import { installIntersectionObserverMock } from "./tests/intersection-observer";

// jsdom does not implement ResizeObserver, matchMedia, or getAnimations,
// which useStickToBottom and the Base UI ScrollArea need to track chat
// viewport size and motion. No-op stubs keep component tests rendering.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom also has no IntersectionObserver, which the "load earlier" sentinel
// (Plan 10-04) needs. The mock + its triggerIntersection helper live in
// tests/intersection-observer.ts (shared registry) — this only installs it.
installIntersectionObserverMock();

if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  window.matchMedia = (query: string) => {
    const widthMatch = query.match(/\((min|max)-width:\s*([\d.]+)(px|rem)\)/);
    const threshold = widthMatch
      ? Number(widthMatch[2]) * (widthMatch[3] === "rem" ? 16 : 1)
      : 0;
    const matches = widthMatch?.[1] === "min"
      ? window.innerWidth >= threshold
      : widthMatch?.[1] === "max"
        ? window.innerWidth <= threshold
        : false;

    return ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  };
}

if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.getAnimations === "undefined"
) {
  Element.prototype.getAnimations = () => [];
}

if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollTo === "undefined"
) {
  Element.prototype.scrollTo = () => {};
}
