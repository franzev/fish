import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export interface CommunityMessageRowLayoutProps
  extends HTMLAttributes<HTMLDivElement> {
  avatarSlot: ReactNode;
  startsGroup: boolean;
  hasPrecedingRow: boolean;
  interactive: boolean;
}

/** Shared geometry for final community messages and their loading skeletons. */
export function CommunityMessageRowLayout({
  avatarSlot,
  startsGroup,
  hasPrecedingRow,
  interactive,
  children,
  className,
  ...props
}: CommunityMessageRowLayoutProps) {
  return (
    <div
      {...props}
      data-layout="community-message-row"
      className={cn(
        "relative flex -mx-md items-start gap-md px-md py-2xs",
        hasPrecedingRow && startsGroup && "py-sm",
        interactive && "group transition-colors hover:bg-surface",
        className
      )}
    >
      {avatarSlot}
      <div className="flex min-w-0 flex-1 flex-col items-start">{children}</div>
    </div>
  );
}
