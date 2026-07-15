export type ThemePref = "light" | "dark" | null;

export const THEME_PREFERENCE_COOKIE = "fish-theme";

export function parseThemePreference(
  value: string | null | undefined
): ThemePref {
  return value === "light" || value === "dark" ? value : null;
}
