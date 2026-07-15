"use client";

import { IconButton } from "@/components/ui/icon-button";
import { applyTheme } from "@/lib/prefs/apply-prefs";
import {
  THEME_PREFERENCE_COOKIE,
  type ThemePref,
} from "@/lib/prefs/theme-preference";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useState, useSyncExternalStore } from "react";

export interface ThemeToggleProps {
  initialTheme?: ThemePref;
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function subscribeToSystemTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getBrowserTheme(): Exclude<ThemePref, null> {
  const documentTheme = document.documentElement.dataset.theme;

  if (documentTheme === "light" || documentTheme === "dark") {
    return documentTheme;
  }

  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light";
}

function getServerTheme(): Exclude<ThemePref, null> {
  return "light";
}

/** Switches between light and dark mode and keeps the visitor's choice for
 * signed-out pages. The optional initial value avoids a theme flash when the
 * server already knows the visitor preference. */
export function ThemeToggle({ initialTheme = null }: ThemeToggleProps) {
  const browserTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getBrowserTheme,
    getServerTheme
  );
  const [preference, setPreference] = useState<ThemePref>(initialTheme);
  const currentTheme = preference ?? browserTheme;
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextTheme} mode`;

  function toggleTheme() {
    setPreference(nextTheme);
    applyTheme(nextTheme);
    document.cookie = `${THEME_PREFERENCE_COOKIE}=${nextTheme}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
  }

  return (
    <IconButton
      appearance="ghost"
      label={label}
      tooltip
      tooltipSide="bottom"
      onClick={toggleTheme}
      icon={
        currentTheme === "light" ? (
          <IconSun aria-hidden="true" />
        ) : (
          <IconMoon aria-hidden="true" />
        )
      }
    />
  );
}
