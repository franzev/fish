import { cn } from "@/lib/utils";
import Link from "next/link";

/* The product name set in the heading serif — the whole brand mark, no
 *  glyph. Links home from public pages; the padded flex box keeps the
 *  small text inside a comfortable target. */
export interface WordmarkProps {
  className?: string;
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-target-touch items-center font-serif text-heading-sm font-semibold text-foreground",
        className
      )}
    >
      FISH
    </Link>
  );
}
