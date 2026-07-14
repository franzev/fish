import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SPACING_TOKENS = [
  "3xs",
  "2xs",
  "nudge",
  "xs",
  "compact",
  "sm",
  "field-y",
  "md",
  "page",
  "lg",
  "xl",
  "2xl",
  "mobile-nav-offset",
  "control",
  "field-message",
  "badge",
  "chat-demo",
  "chat-list-demo",
  "chat-container-demo",
  "motion-enter",
  "motion-typing",
] as const;

/* Without these groups twMerge can't tell the custom type scale from the
   color tokens — `text-body` and `text-ui-sm` both fall into its default
   font-size bucket, so whichever comes later silently swallows the other. */
const FONT_SIZE_TOKENS = [
  "ui-3xs",
  "ui-2xs",
  "ui-xs",
  "ui-sm",
  "ui",
  "ui-md",
  "copy",
  "heading-sm",
  "emoji",
  "display",
] as const;

const TEXT_COLOR_TOKENS = [
  "bg",
  "surface",
  "surface-2",
  "surface-3",
  "border",
  "border-strong",
  "primary",
  "primary-press",
  "on-primary",
  "foreground",
  "body",
  "muted",
  "notice",
  "error",
  "warning",
  "success",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      gap: SPACING_TOKENS,
      inset: SPACING_TOKENS,
      margin: SPACING_TOKENS,
      padding: SPACING_TOKENS,
      space: SPACING_TOKENS,
      spacing: SPACING_TOKENS,
      translate: SPACING_TOKENS,
    },
    classGroups: {
      "font-size": [{ text: [...FONT_SIZE_TOKENS] }],
      "text-color": [{ text: [...TEXT_COLOR_TOKENS] }],
    },
  },
});

/** Merge conditional class names and resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
