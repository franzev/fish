import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MediaPickerScrollAreaProps {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
}

/** Shared scrolling content inset for expressive-media pickers. */
export function MediaPickerScrollArea({
  children,
  className,
  viewportClassName,
}: MediaPickerScrollAreaProps) {
  return (
    <ScrollArea
      className={cn("flex-1", className)}
      viewportClassName={cn(
        "scroll-smooth px-xs pb-xs",
        viewportClassName
      )}
    >
      {children}
    </ScrollArea>
  );
}
