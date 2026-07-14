export type TimeFormatPref = "12h" | "24h" | null;

export const TIME_FORMAT_PREF_CHANGE_EVENT = "fish:time-format-pref-change";

interface FormatTimeOptions {
  locale?: string;
  timeZone?: string;
}

export function normalizeTimeFormatPref(
  value: string | null | undefined
): TimeFormatPref {
  return value === "12h" || value === "24h" ? value : null;
}

export function formatTimeOfDay(
  sentAt: Date | string,
  pref: TimeFormatPref,
  options: FormatTimeOptions = {}
): string {
  const date = typeof sentAt === "string" ? new Date(sentAt) : sentAt;
  if (Number.isNaN(date.getTime())) return "";

  const formatOptions: Intl.DateTimeFormatOptions = {
    hour: pref === "24h" ? "2-digit" : "numeric",
    minute: "2-digit",
  };

  if (pref === "12h") {
    formatOptions.hourCycle = "h12";
  }

  if (pref === "24h") {
    formatOptions.hourCycle = "h23";
  }

  if (options.timeZone) {
    formatOptions.timeZone = options.timeZone;
  }

  return new Intl.DateTimeFormat(options.locale, formatOptions).format(date);
}

export function notifyTimeFormatPrefChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(TIME_FORMAT_PREF_CHANGE_EVENT));
}
