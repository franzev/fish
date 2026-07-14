import type { ReactNode } from "react";

export interface PopoverHeaderProps {
  title: ReactNode;
  actions: ReactNode;
}

export function PopoverHeader({ title, actions }: PopoverHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-sm border-b border-divider p-md">
      <div className="min-w-0 flex-1">{title}</div>
      <div className="flex shrink-0 items-center gap-2xs">{actions}</div>
    </div>
  );
}
