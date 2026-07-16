import { useEffect, useRef } from "react";

const DESKTOP_QUERY = "(min-width: 48rem)";

/** Preserves the familiar desktop first-field focus without opening a mobile
 * software keyboard before the user has read the screen. */
export function useDesktopAutofocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!window.matchMedia(DESKTOP_QUERY).matches) return;
    ref.current?.focus({ preventScroll: true });
  }, []);

  return ref;
}
