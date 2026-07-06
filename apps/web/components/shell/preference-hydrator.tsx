"use client";

import {
  applyReducedMotion,
  applyTextSize,
  applyTheme,
  applyTimeFormat,
} from "@/lib/prefs/apply-prefs";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import { useEffect } from "react";

type ThemePref = "light" | "dark" | null;
type TextSizePref = "default" | "large" | "larger" | null;

interface PreferenceHydratorProps {
  themePref?: ThemePref;
  textSizePref?: TextSizePref;
  reducedMotionPref?: boolean | null;
  timeFormatPref?: TimeFormatPref;
}

/* Authenticated routes share one html element, so persisted preferences need
   to hydrate at the shell level rather than only inside /profile's settings
   rows. The helpers only flip data-* attributes; stylesheet rules keep the
   Lightning CSS light-dark() behavior intact. */
export function PreferenceHydrator({
  themePref,
  textSizePref,
  reducedMotionPref,
  timeFormatPref,
}: PreferenceHydratorProps) {
  useEffect(() => {
    applyTheme(themePref ?? null);
    applyTextSize(textSizePref ?? null);
    applyReducedMotion(reducedMotionPref ?? null);
    applyTimeFormat(timeFormatPref ?? null);
  }, [reducedMotionPref, textSizePref, themePref, timeFormatPref]);

  return null;
}
