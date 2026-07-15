"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
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
    <SegmentedControl
      label="Preview theme"
      value={mode}
      shape="control"
      options={[
        { label: "system", value: "system" },
        { label: "light", value: "light" },
        { label: "dark", value: "dark" },
      ]}
      onValueChange={setMode}
    />
  );
}
