"use client";

import { cn } from "@/lib/utils";
import { Tabs } from "@base-ui/react/tabs";
import { Tooltip } from "@base-ui/react/tooltip";
import type { TablerIcon } from "@tabler/icons-react";

export interface IconTabStripItem {
  value: string;
  label: string;
  Icon: TablerIcon;
}

interface IconTabStripBaseProps {
  items: readonly IconTabStripItem[];
  ariaLabel: string;
  className?: string;
}

interface IconTabStripTabsProps extends IconTabStripBaseProps {
  selectionMode?: "tabs";
  value?: never;
  onValueChange?: never;
}

interface IconTabStripFilterProps extends IconTabStripBaseProps {
  selectionMode: "filter";
  value: string;
  onValueChange: (value: string) => void;
}

export type IconTabStripProps =
  | IconTabStripTabsProps
  | IconTabStripFilterProps;

/** A bottom-aligned icon strip for compact categories and filters. Tab mode
 * must be rendered inside a Tabs.Root; filter mode uses pressed buttons.
 * Both modes share Base UI tooltips and the same visual treatment. */
export function IconTabStrip({
  items,
  ariaLabel,
  className,
  selectionMode = "tabs",
  value: selectedValue,
  onValueChange,
}: IconTabStripProps) {
  const stripClassName = cn(
    "flex shrink-0 border-t border-divider bg-surface px-nudge py-2xs",
    className
  );

  return (
    <Tooltip.Provider delay={400} closeDelay={0}>
      {selectionMode === "tabs" ? (
        <Tabs.List aria-label={ariaLabel} className={stripClassName}>
          {items.map(({ value, label, Icon }) => (
            <Tooltip.Root key={value}>
              <Tooltip.Trigger
                render={
                  <Tabs.Tab
                    value={value}
                    aria-label={label}
                    className="icon-button-glyph group flex min-h-target-touch flex-1 items-center justify-center rounded-control text-muted data-[active]:text-foreground"
                  >
                    <span className="flex items-center justify-center rounded-pill p-2xs group-hover:bg-surface-2 group-data-[active]:bg-surface-2">
                      <Icon size={20} stroke={1.75} aria-hidden="true" />
                    </span>
                  </Tabs.Tab>
                }
              />
              {renderIconTooltipPopup(label)}
            </Tooltip.Root>
          ))}
        </Tabs.List>
      ) : (
        <div role="group" aria-label={ariaLabel} className={stripClassName}>
          {items.map(({ value, label, Icon }) => {
            const selected = selectedValue === value;
            return (
              <Tooltip.Root key={value}>
                <Tooltip.Trigger
                  render={
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={selected}
                      onClick={() => onValueChange?.(value)}
                      className={cn(
                        "icon-button-glyph group flex min-h-target-touch flex-1 items-center justify-center rounded-control",
                        selected ? "text-foreground" : "text-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center rounded-pill p-2xs group-hover:bg-surface-2",
                          selected && "bg-surface-2"
                        )}
                      >
                        <Icon size={20} stroke={1.75} aria-hidden="true" />
                      </span>
                    </button>
                  }
                />
                {renderIconTooltipPopup(label)}
              </Tooltip.Root>
            );
          })}
        </div>
      )}
    </Tooltip.Provider>
  );
}

function renderIconTooltipPopup(label: string) {
  return (
    <Tooltip.Portal>
      <Tooltip.Positioner side="top" sideOffset={4} className="z-30">
        <Tooltip.Popup
          role="tooltip"
          className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg"
        >
          {label}
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  );
}
