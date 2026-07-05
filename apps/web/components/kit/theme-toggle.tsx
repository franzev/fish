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
    <div role="group" aria-label="Preview theme" className="flex gap-2">
      {(["system", "light", "dark"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => setMode(opt)}
          aria-pressed={mode === opt}
          className={cn(
            "min-h-control rounded-control border px-4 text-ui transition-colors",
            // Active state signals with color only — a font-weight flip
            // would resize the buttons on every click (layout stability).
            mode === opt
              ? "border-border-strong bg-surface-2 text-foreground"
              : "border-border bg-surface text-muted hover:text-body"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
