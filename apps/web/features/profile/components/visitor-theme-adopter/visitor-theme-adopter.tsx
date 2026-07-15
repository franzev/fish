"use client";

import { adoptThemePreferenceAction } from "@/features/profile/server/actions";
import { reportOperationalError } from "@/lib/observability/reporter";
import {
  THEME_PREFERENCE_COOKIE,
  type ThemePref,
} from "@/lib/prefs/theme-preference";
import { useEffect } from "react";

interface VisitorThemeAdopterProps {
  theme: Exclude<ThemePref, null>;
}

/** Moves the signed-out browser choice into the authenticated client profile.
 * The temporary cookie is cleared only after the durable write succeeds. */
export function VisitorThemeAdopter({ theme }: VisitorThemeAdopterProps) {
  useEffect(() => {
    void adoptThemePreferenceAction(theme)
      .then((saved) => {
        if (saved) {
          document.cookie = `${THEME_PREFERENCE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
        }
      })
      .catch((error) => {
        reportOperationalError(error, {
          operation: "profile.theme.adopt",
          handled: true,
          recoverable: true,
          runtime: "browser",
        });
      });
  }, [theme]);

  return null;
}
