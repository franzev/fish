"use client";

import { SettingsRow } from "../settings-row";
import {
  applyReducedMotion,
  applyTextSize,
  applyTheme,
  applyTimeFormat,
} from "@/lib/prefs/apply-prefs";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  updatePrefsAction,
  type UpdatePrefsInput,
} from "@/features/profile/server/actions";

type ThemePref = "light" | "dark" | null;
type TextSizePref = "default" | "large" | "larger" | null;
type ReducedMotionPref = boolean | null;

interface A11yPrefsProps {
  themePref: ThemePref;
  textSizePref: TextSizePref;
  reducedMotionPref: ReducedMotionPref;
  timeFormatPref: TimeFormatPref;
}

const themeOptions: Array<{ value: ThemePref; label: string }> = [
  { value: null, label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const textSizeOptions: Array<{ value: TextSizePref; label: string }> = [
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "larger", label: "Larger" },
];

const reducedMotionOptions: Array<{ value: ReducedMotionPref; label: string }> = [
  { value: null, label: "System" },
  { value: true, label: "On" },
  { value: false, label: "Off" },
];

const timeFormatOptions: Array<{ value: TimeFormatPref; label: string }> = [
  { value: null, label: "System" },
  { value: "12h", label: "12 hr" },
  { value: "24h", label: "24 hr" },
];

/** Segmented control shared by profile prefs -- 56px-tall pill buttons,
 *  active state signaled by color/border only (no size/weight change, so
 *  clicking never resizes the row -- layout-stability contract). */
function SegmentedControl<T>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-xs">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "min-h-control rounded-pill border px-sm text-ui-sm transition-colors",
            value === opt.value
              ? "border-border-strong bg-surface-2 text-foreground"
              : "border-border bg-surface text-muted hover:text-body"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** The profile preferences: theme, text size, reduced motion, and time
 *  format. System-backed options default to "follow system" (null). Changing one
 *  applies instantly via the data-* attribute helpers, then persists to
 *  client_profiles through the Server Action so it rehydrates on next load
 *  / another device (D-14). On mount, re-applies the stored prefs from
 *  props -- matches KitThemeToggle's own useEffect-on-mount shape. */
export function A11yPrefs({
  themePref: initialTheme,
  textSizePref: initialTextSize,
  reducedMotionPref: initialReducedMotion,
  timeFormatPref: initialTimeFormat,
}: A11yPrefsProps) {
  const [theme, setTheme] = useState<ThemePref>(initialTheme);
  const [textSize, setTextSize] = useState<TextSizePref>(
    initialTextSize ?? "default"
  );
  const [reducedMotion, setReducedMotion] =
    useState<ReducedMotionPref>(initialReducedMotion);
  const [timeFormat, setTimeFormat] =
    useState<TimeFormatPref>(initialTimeFormat);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyTextSize(textSize);
  }, [textSize]);

  useEffect(() => {
    applyReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    applyTimeFormat(timeFormat);
  }, [timeFormat]);

  function persist(next: UpdatePrefsInput) {
    void updatePrefsAction(next);
  }

  return (
    <>
      <SettingsRow
        label="Appearance"
        control={
          <SegmentedControl
            ariaLabel="Appearance"
            options={themeOptions}
            value={theme}
            onChange={(next) => {
              setTheme(next);
              persist({
                themePref: next,
                textSizePref: textSize,
                reducedMotionPref: reducedMotion,
                timeFormatPref: timeFormat,
              });
            }}
          />
        }
      />
      <SettingsRow
        label="Text size"
        control={
          <SegmentedControl
            ariaLabel="Text size"
            options={textSizeOptions}
            value={textSize}
            onChange={(next) => {
              setTextSize(next);
              persist({
                themePref: theme,
                textSizePref: next,
                reducedMotionPref: reducedMotion,
                timeFormatPref: timeFormat,
              });
            }}
          />
        }
      />
      <SettingsRow
        label="Reduced motion"
        control={
          <SegmentedControl
            ariaLabel="Reduced motion"
            options={reducedMotionOptions}
            value={reducedMotion}
            onChange={(next) => {
              setReducedMotion(next);
              persist({
                themePref: theme,
                textSizePref: textSize,
                reducedMotionPref: next,
                timeFormatPref: timeFormat,
              });
            }}
          />
        }
      />
      <SettingsRow
        label="Time format"
        control={
          <SegmentedControl
            ariaLabel="Time format"
            options={timeFormatOptions}
            value={timeFormat}
            onChange={(next) => {
              setTimeFormat(next);
              persist({
                themePref: theme,
                textSizePref: textSize,
                reducedMotionPref: reducedMotion,
                timeFormatPref: next,
              });
            }}
          />
        }
      />
    </>
  );
}
