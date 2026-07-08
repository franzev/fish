import "@testing-library/jest-dom/vitest";

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

if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
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
