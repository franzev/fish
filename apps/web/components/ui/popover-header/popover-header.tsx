import type { ReactNode } from "react";
import { SurfaceHeader } from "@/components/ui/surface-header";

export interface PopoverHeaderProps {
  title: ReactNode;
  actions: ReactNode;
}

export function PopoverHeader({ title, actions }: PopoverHeaderProps) {
  return <SurfaceHeader title={title} action={actions} />;
}
