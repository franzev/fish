"use client";

import {
  applyReducedMotion,
  applyTextSize,
  applyTheme,
} from "@/lib/prefs/apply-prefs";
import { useEffect } from "react";

type ThemePref = "light" | "dark" | null;
type TextSizePref = "default" | "large" | "larger" | null;

interface PreferenceHydratorProps {
  themePref?: ThemePref;
  textSizePref?: TextSizePref;
  reducedMotionPref?: boolean | null;
}

/* Authenticated routes share one html element, so persisted preferences need
   to hydrate at the shell level rather than only inside /profile's settings
   rows. The helpers only flip data-* attributes; stylesheet rules keep the
   Lightning CSS light-dark() behavior intact. */
export function PreferenceHydrator({
  themePref,
  textSizePref,
  reducedMotionPref,
}: PreferenceHydratorProps) {
  useEffect(() => {
    applyTheme(themePref ?? null);
    applyTextSize(textSizePref ?? null);
    applyReducedMotion(reducedMotionPref ?? null);
  }, [reducedMotionPref, textSizePref, themePref]);

  return null;
}
