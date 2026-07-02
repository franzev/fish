"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type ThemeOverride = "system" | "light" | "dark";

/** Dev-only theme preview for /kit. Not part of the product-facing kit —
    clients never choose themes; this exists so both themes can be judged. */
export function KitThemeToggle() {
  const [mode, setMode] = useState<ThemeOverride>("system");

  useEffect(() => {
    // Overriding color-scheme re-resolves every light-dark() token natively.
    document.documentElement.style.colorScheme =
      mode === "system" ? "light dark" : mode;
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
            "min-h-[var(--size-control)] rounded-control border px-4 text-[15px] transition-colors",
            mode === opt
              ? "border-border-strong bg-surface-2 font-medium text-foreground"
              : "border-border bg-surface text-muted hover:text-body"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
