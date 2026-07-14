"use client";

import { useSyncExternalStore } from "react";
import {
  normalizeTimeFormatPref,
  TIME_FORMAT_PREF_CHANGE_EVENT,
  type TimeFormatPref,
} from "@/lib/prefs/time-format";

function getAppliedTimeFormatPref(): TimeFormatPref {
  if (typeof document === "undefined") {
    return null;
  }

  return normalizeTimeFormatPref(document.documentElement.dataset.timeFormat);
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(TIME_FORMAT_PREF_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener(TIME_FORMAT_PREF_CHANGE_EVENT, onStoreChange);
  };
}

export function useTimeFormatPreference(): TimeFormatPref {
  return useSyncExternalStore(subscribe, getAppliedTimeFormatPref, () => null);
}
