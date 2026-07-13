"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type ThemeOverride = "system" | "light" | "dark";

/** Dev-only theme preview for /kit. Not part of the product-facing kit —
    clients never choose themes; this exists so both themes can be judged. */
export function KitThemeToggle() {
  const [mode, setMode] = useState<ThemeOverride>("system");

  useEffect(() => {
    // Flip a data attribute, not an inline style: globals.css carries
    // html[data-kit-theme] color-scheme rules that the build pipeline
    // (Lightning CSS) compiles into its light-dark() polyfill-variable
    // flips. An inline style.colorScheme mutation is invisible to that
    // polyfill, so tokens would never re-resolve (the reported /kit bug).
    if (mode === "system") {
      delete document.documentElement.dataset.kitTheme;
    } else {
      document.documentElement.dataset.kitTheme = mode;
    }
  }, [mode]);

  return (
    <div role="group" aria-label="Preview theme" className="flex gap-xs">
      {(["system", "light", "dark"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => setMode(opt)}
          aria-pressed={mode === opt}
          className={cn(
            "min-h-control rounded-control px-md text-ui-sm transition-colors",
            // Active state signals with the fill step only — a font-weight
            // flip would resize the buttons on every click (layout stability).
            mode === opt
              ? "bg-surface-3 text-foreground"
              : "bg-surface-2 text-body hover:bg-surface-3"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
