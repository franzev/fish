"use client";

import {
  applyReducedMotion,
  applyTheme,
  applyTimeFormat,
} from "@/lib/prefs/apply-prefs";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import { useEffect } from "react";

type ThemePref = "light" | "dark" | null;

interface PreferenceHydratorProps {
  themePref?: ThemePref;
  reducedMotionPref?: boolean | null;
  timeFormatPref?: TimeFormatPref;
}

/* Authenticated routes share one html element, so persisted preferences need
   to hydrate at the shell level rather than only inside /profile's settings
   rows. The helpers only flip data-* attributes; stylesheet rules keep the
   Lightning CSS light-dark() behavior intact. */
export function PreferenceHydrator({
  themePref,
  reducedMotionPref,
  timeFormatPref,
}: PreferenceHydratorProps) {
  useEffect(() => {
    applyTheme(themePref ?? null);
    applyReducedMotion(reducedMotionPref ?? null);
    applyTimeFormat(timeFormatPref ?? null);
  }, [reducedMotionPref, themePref, timeFormatPref]);

  return null;
}
