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
  },
});

/** Merge conditional class names and resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
