"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip } from "@base-ui/react/tooltip";
import { forwardRef, type ReactNode } from "react";

export interface TooltipIconButtonProps
  extends Omit<ButtonProps, "aria-label" | "children" | "controlSize"> {
  label: string;
  icon: ReactNode;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipClassName?: string;
}

/** A shared square action with an accessible name and matching visual tooltip. */
export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(function TooltipIconButton(
  {
    label,
    icon,
    tooltipSide = "top",
    tooltipClassName,
    variant = "secondary",
    ...buttonProps
  },
  ref
) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            {...buttonProps}
            ref={ref}
            variant={variant}
            controlSize="square"
            aria-label={label}
          >
            {icon}
          </Button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner
          side={tooltipSide}
          sideOffset={4}
          className={cn("z-50", tooltipClassName)}
        >
          <Tooltip.Popup
            role="tooltip"
            className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg"
          >
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});
