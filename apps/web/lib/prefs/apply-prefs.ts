import {
  notifyTimeFormatPrefChanged,
  type TimeFormatPref,
} from "@/lib/prefs/time-format";

/* Instant-apply, client-side only. Mirrors KitThemeToggle's data-attribute +
   Lightning CSS mechanism (the ONE piece of that dev-only tool worth
   copying, RESEARCH Pattern 4) under NEW, product-facing attribute names
   (data-theme/data-text-size/data-reduced-motion) so a real session and an
   open /kit tab never collide. Dataset flips ONLY -- never
   `.style.colorScheme`/`.style.fontSize` (Pitfall 5): the build pipeline
   (Lightning CSS) downlevels light-dark() into a prefers-color-scheme
   polyfill computed from stylesheet rules present at build time; an inline
   style mutation is invisible to it. NULL/absent = follow system = delete
   the attribute (D-04/D-14). */

export function applyTheme(pref: "light" | "dark" | null): void {
  if (pref === null) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = pref;
  }
}

export function applyTextSize(
  pref: "default" | "large" | "larger" | null
): void {
  if (pref === null || pref === "default") {
    delete document.documentElement.dataset.textSize;
  } else {
    document.documentElement.dataset.textSize = pref;
  }
}

export function applyReducedMotion(pref: boolean | null): void {
  if (pref === null) {
    delete document.documentElement.dataset.reducedMotion;
  } else {
    document.documentElement.dataset.reducedMotion = String(pref);
  }
}

export function applyTimeFormat(pref: TimeFormatPref): void {
  if (pref === null) {
    delete document.documentElement.dataset.timeFormat;
  } else {
    document.documentElement.dataset.timeFormat = pref;
  }

  notifyTimeFormatPrefChanged();
}
