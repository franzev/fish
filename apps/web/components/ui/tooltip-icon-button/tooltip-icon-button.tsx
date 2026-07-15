"use client";

import {
  IconButton,
  type IconButtonActionProps,
} from "@/components/ui/icon-button";
import { forwardRef } from "react";

export interface TooltipIconButtonProps
  extends Omit<IconButtonActionProps, "appearance"> {
  variant?: "primary" | "secondary" | "ghost";
}

/** @deprecated Use IconButton. This compatibility wrapper has no visual logic. */
export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(function TooltipIconButton(
  { variant = "secondary", tooltip = true, ...props },
  ref
) {
  return (
    <IconButton
      {...props}
      tooltip={tooltip}
      ref={ref}
      appearance={
        variant === "primary"
          ? "solid"
          : variant === "ghost"
            ? "ghost"
            : "surface"
      }
    />
  );
});
