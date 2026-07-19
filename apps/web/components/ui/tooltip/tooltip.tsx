"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

export interface TooltipProps {
  label: ReactNode;
  children: ReactElement;
  disabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  positionerClassName?: string;
  className?: string;
}

export function Tooltip({
  label,
  children,
  disabled = false,
  side = "top",
  sideOffset = 4,
  positionerClassName = "z-30",
  className,
}: TooltipProps) {
  return (
    <BaseTooltip.Provider delay={400} closeDelay={0}>
      <BaseTooltip.Root disabled={disabled}>
        <BaseTooltip.Trigger render={children} />
        {!disabled && (
          <BaseTooltip.Portal>
            <BaseTooltip.Positioner side={side} sideOffset={sideOffset} className={positionerClassName}>
              <BaseTooltip.Popup
                role="tooltip"
                className={className ?? "rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg"}
              >
                {label}
              </BaseTooltip.Popup>
            </BaseTooltip.Positioner>
          </BaseTooltip.Portal>
        )}
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}
