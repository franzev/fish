"use client";

import { cn } from "@/lib/utils";
import { Menu } from "@base-ui/react/menu";
import type { ComponentProps } from "react";

export const ActionMenuRoot = Menu.Root;
export const ActionMenuTrigger = Menu.Trigger;
export const ActionMenuRadioGroup = Menu.RadioGroup;
export const ActionMenuRadioItem = Menu.RadioItem;

export type ActionMenuItemProps = ComponentProps<typeof Menu.Item>;

export function ActionMenuItem({ className, ...props }: ActionMenuItemProps) {
  return (
    <Menu.Item
      className={cn(
        "flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2",
        className
      )}
      {...props}
    />
  );
}

export interface ActionMenuPopupProps
  extends Omit<ComponentProps<typeof Menu.Popup>, "className"> {
  className?: string;
  positionerClassName?: string;
  side?: "top" | "right" | "bottom" | "left" | "inline-start" | "inline-end";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  width?: "menu" | "content";
}

export function ActionMenuPopup({
  className,
  positionerClassName,
  side = "bottom",
  align = "end",
  sideOffset = 4,
  width = "menu",
  ...props
}: ActionMenuPopupProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50", positionerClassName)}
      >
        <Menu.Popup
          className={cn(
            "rounded-card border border-divider bg-surface p-3xs",
            width === "menu" ? "min-w-menu" : "w-max",
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}
