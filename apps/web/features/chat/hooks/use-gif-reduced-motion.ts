"use client";

import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MOBILE_QUERY = "(max-width: 47.999rem)";

function subscribe(onChange: () => void) {
  const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  const mobileQuery = window.matchMedia(MOBILE_QUERY);
  const observer = new MutationObserver(onChange);

  reducedMotionQuery.addEventListener("change", onChange);
  mobileQuery.addEventListener("change", onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-reduced-motion"],
  });

  return () => {
    reducedMotionQuery.removeEventListener("change", onChange);
    mobileQuery.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function getSnapshot() {
  const osPrefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  const mobileAppPreference =
    window.matchMedia(MOBILE_QUERY).matches &&
    document.documentElement.dataset.reducedMotion === "true";

  return osPrefersReducedMotion || mobileAppPreference;
}

/** GIF playback keeps its existing desktop behavior while honoring both the
 * operating-system setting and FISH's explicit preference on mobile. */
export function useGifReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
