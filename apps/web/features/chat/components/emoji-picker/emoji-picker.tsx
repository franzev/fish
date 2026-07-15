"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { IconTabStrip, type IconTabStripItem } from "@/components/ui/icon-tab-strip";
import {
  IconBallBasketball,
  IconBulb,
  IconCar,
  IconFlag,
  IconHandStop,
  IconHash,
  IconMoodSmile,
  IconPaw,
  IconToolsKitchen2,
  type TablerIcon,
} from "@tabler/icons-react";
import { Popover } from "@base-ui/react/popover";
import { Tabs } from "@base-ui/react/tabs";
import { Tooltip } from "@base-ui/react/tooltip";
import groups from "unicode-emoji-json/data-by-group.json";
import { type ReactElement, ReactNode, forwardRef, useMemo, useState } from "react";
import { MediaPickerScrollArea } from "../media-picker-scroll-area";
import { MediaPickerSearch } from "../media-picker-search";

interface EmojiEntry {
  emoji: string;
  name: string;
  slug: string;
}

interface EmojiGroup {
  name: string;
  slug: string;
  emojis: EmojiEntry[];
}

// Bundled dataset (unicode-emoji-json) — no CDN calls, no network dependency
// for the picker to render.
const emojiGroups = groups as EmojiGroup[];

// Monochrome Tabler icon per category — colored emoji glyphs as tab icons
// competed with the grid; icons keep the tab strip quiet (structural UI
// carries no color).
const groupIcons: Record<string, TablerIcon> = {
  "Smileys & Emotion": IconMoodSmile,
  "People & Body": IconHandStop,
  "Animals & Nature": IconPaw,
  "Food & Drink": IconToolsKitchen2,
  "Travel & Places": IconCar,
  Activities: IconBallBasketball,
  Objects: IconBulb,
  Symbols: IconHash,
  Flags: IconFlag,
};

const groupTabs: readonly IconTabStripItem[] = emojiGroups.map((group) => ({
  value: group.slug,
  label: group.name,
  Icon: groupIcons[group.name] ?? IconMoodSmile,
}));

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
  embedded?: boolean;
}

/** Grouped + searchable monochrome emoji panel. Composed entirely of native
 *  buttons + the shared Input, so tab order and the global focus-visible
 *  ring already work without extra wiring. When search is empty the 9
 *  categories are organized into Base UI Tabs; typing a query flattens
 *  results across every category. */
export function EmojiPicker({ onSelect, className, embedded = false }: EmojiPickerProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return emojiGroups
      .flatMap((group) => group.emojis)
      .filter(
        (entry) =>
          entry.name.toLowerCase().includes(q) ||
          entry.slug.toLowerCase().includes(q)
      );
  }, [query]);

  const PickerRoot = embedded ? "div" : Card;

  return (
    <PickerRoot
      className={cn(
        "flex flex-col overflow-hidden bg-surface",
        embedded
          ? "h-full min-h-0 w-full"
          : "h-emoji-panel-h w-emoji-panel border border-divider p-0",
        className
      )}
      role={embedded ? "region" : "dialog"}
      aria-label={embedded ? "Browse emoji" : "Choose an emoji"}
    >
      <MediaPickerSearch
        label="Search emoji"
        placeholder="Search emoji"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results ? (
        <MediaPickerScrollArea>
          {results.length === 0 ? (
            <p className="p-xs text-ui-sm text-muted">
              No emoji match that yet.
            </p>
          ) : (
            <EmojiGroupList
              heading="Results"
              emojis={results}
              onSelect={onSelect}
            />
          )}
        </MediaPickerScrollArea>
      ) : (
        <Tabs.Root
          defaultValue={emojiGroups[0]?.slug}
          className="flex min-h-0 flex-1 flex-col"
        >
          {emojiGroups.map((group) => (
            <Tabs.Panel
              key={group.slug}
              value={group.slug}
              className="flex min-h-0 flex-1 flex-col"
            >
              <MediaPickerScrollArea>
                <EmojiGroupList emojis={group.emojis} onSelect={onSelect} />
              </MediaPickerScrollArea>
            </Tabs.Panel>
          ))}
          <IconTabStrip items={groupTabs} ariaLabel="Emoji category" />
        </Tabs.Root>
      )}
    </PickerRoot>
  );
}

function EmojiGroupList({
  heading,
  emojis,
  onSelect,
}: {
  heading?: string;
  emojis: EmojiEntry[];
  onSelect: (emoji: string) => void;
}) {
  return (
    <div className="mb-sm">
      {heading && <p className="mb-2xs text-ui-xs text-muted">{heading}</p>}
      <div className="grid grid-cols-6 gap-2xs">
        {emojis.map((entry) => (
          <button
            key={entry.slug}
            type="button"
            aria-label={entry.name}
            onClick={() => onSelect(entry.emoji)}
            className="flex min-h-target-touch w-full items-center justify-center rounded-control hover:bg-surface-2"
          >
            <span aria-hidden="true" className="text-emoji">
              {entry.emoji}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  label: string;
  className?: string;
  children?: ReactNode;
  trigger?: ReactElement;
}

/** Self-contained popover trigger — an icon button (default smiley) that
 *  opens the grouped/searchable EmojiPicker panel in a Base UI Popover
 *  (portaled to <body>, collision-aware flip/align, Escape + outside-click
 *  dismiss, and focus return handled for free). Closes on selecting an
 *  emoji. */
export const EmojiPickerButton = forwardRef<
  HTMLButtonElement,
  EmojiPickerButtonProps
>(function EmojiPickerButton(
  { onSelect, label, className, children, trigger: triggerElement },
  ref
) {
    const [open, setOpen] = useState(false);
    const triggerControl =
      triggerElement ? (
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Popover.Trigger
                ref={ref}
                aria-label={label}
                render={triggerElement}
              />
            }
          />
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={4} className="z-50">
              <Tooltip.Popup
                role="tooltip"
                className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg"
              >
                {label}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : (
        <Popover.Trigger
          render={
            <IconButton
              ref={ref}
              label={label}
              appearance="ghost"
              tooltip
              className={className}
              icon={children ?? (
                <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />
              )}
            />
          }
        />
      );

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        {triggerControl}
        <Popover.Portal>
          <Popover.Positioner
            side="top"
            align="end"
            sideOffset={4}
            className="z-20"
          >
            {/* Keep focus on the trigger at open — autofocusing the search
                field flashes a focus ring on every open and pops the mobile
                keyboard over the grid. Tab reaches the field in one step. */}
            <Popover.Popup initialFocus={false}>
              <EmojiPicker
                onSelect={(emoji) => {
                  onSelect(emoji);
                  setOpen(false);
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
