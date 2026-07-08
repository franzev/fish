"use client";

import { cn } from "@/lib/utils";
import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import { ReactNode } from "react";

interface ScrollAreaProps {
  children: ReactNode;
  /** Applied to the outer root (size it here — e.g. flex-1, h-full). */
  className?: string;
  /** Applied to the scrolling viewport (padding for content goes here). */
  viewportClassName?: string;
}

/** Shared vertical scroll region with the product's thin monochrome
 *  scrollbar: invisible at rest, fades in while scrolling or when the
 *  pointer is over the region, fades back out when idle. Use for every
 *  scrollable pane (chat log, emoji panel, lists) so scrollbars look
 *  identical everywhere. */
export function ScrollArea({
  children,
  className,
  viewportClassName,
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root className={cn("relative min-h-0", className)}>
      <BaseScrollArea.Viewport
        className={cn("h-full w-full overscroll-contain", viewportClassName)}
      >
        {children}
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        orientation="vertical"
        className="flex w-nudge justify-center py-3xs opacity-0 transition-opacity duration-200 data-[hovering]:opacity-100 data-[scrolling]:opacity-100"
      >
        <BaseScrollArea.Thumb className="w-2xs rounded-pill bg-border" />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  );
}
