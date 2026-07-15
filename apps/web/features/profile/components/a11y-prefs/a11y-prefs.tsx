"use client";

import { SettingsRow } from "../settings-row";
import { Alert } from "@/components/ui/alert";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  applyReducedMotion,
  applyTheme,
  applyTimeFormat,
} from "@/lib/prefs/apply-prefs";
import { reportOperationalError } from "@/lib/observability/reporter";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import { useEffect, useState } from "react";
import {
  updatePrefsAction,
  type UpdatePrefsInput,
} from "@/features/profile/server/actions";

type ThemePref = "light" | "dark" | null;
type ReducedMotionPref = boolean | null;

interface A11yPrefsProps {
  themePref: ThemePref;
  reducedMotionPref: ReducedMotionPref;
  timeFormatPref: TimeFormatPref;
}

const themeOptions: Array<{ value: ThemePref; label: string }> = [
  { value: null, label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
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

/** The profile preferences: theme, reduced motion, and time format.
 *  System-backed options default to "follow system" (null). Changing one
 *  applies instantly via the data-* attribute helpers, then persists to
 *  client_profiles through the Server Action so it rehydrates on next load
 *  / another device (D-14). On mount, re-applies the stored prefs from
 *  props -- matches KitThemeToggle's own useEffect-on-mount shape. */
export function A11yPrefs({
  themePref: initialTheme,
  reducedMotionPref: initialReducedMotion,
  timeFormatPref: initialTimeFormat,
}: A11yPrefsProps) {
  const [theme, setTheme] = useState<ThemePref>(initialTheme);
  const [reducedMotion, setReducedMotion] =
    useState<ReducedMotionPref>(initialReducedMotion);
  const [timeFormat, setTimeFormat] =
    useState<TimeFormatPref>(initialTimeFormat);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme);
    applyReducedMotion(reducedMotion);
    applyTimeFormat(timeFormat);
  }, [reducedMotion, theme, timeFormat]);

  function persist(next: UpdatePrefsInput) {
    setNotice(null);
    void updatePrefsAction(next).catch((error) => {
      reportOperationalError(error, {
        operation: "profile.preferences.save",
        handled: true,
        recoverable: true,
        runtime: "browser",
      });
      setNotice("That preference couldn’t be saved. Try choosing it again.");
    });
  }

  return (
    <>
      {notice && (
        <div className="p-md">
          <Alert role="status" tone="notice">
            {notice}
          </Alert>
        </div>
      )}
      <SettingsRow
        label="Appearance"
        control={
          <SegmentedControl
            label="Appearance"
            options={themeOptions}
            value={theme}
            onValueChange={(next) => {
              setTheme(next);
              persist({
                themePref: next,
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
            label="Reduced motion"
            options={reducedMotionOptions}
            value={reducedMotion}
            onValueChange={(next) => {
              setReducedMotion(next);
              persist({
                themePref: theme,
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
            label="Time format"
            options={timeFormatOptions}
            value={timeFormat}
            onValueChange={(next) => {
              setTimeFormat(next);
              persist({
                themePref: theme,
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
