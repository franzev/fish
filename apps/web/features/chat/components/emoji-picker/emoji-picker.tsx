"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Icon,
  IconBallBasketball,
  IconBulb,
  IconCar,
  IconFlag,
  IconHandStop,
  IconHash,
  IconMoodSmile,
  IconPaw,
  IconSearch,
  IconToolsKitchen2,
} from "@tabler/icons-react";
import { Popover } from "@base-ui/react/popover";
import { Tabs } from "@base-ui/react/tabs";
import groups from "unicode-emoji-json/data-by-group.json";
import { ReactNode, useMemo, useState } from "react";

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
const groupIcons: Record<string, Icon> = {
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

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

/** Grouped + searchable monochrome emoji panel. Composed entirely of native
 *  buttons + the shared Input, so tab order and the global focus-visible
 *  ring already work without extra wiring. When search is empty the 9
 *  categories are organized into Base UI Tabs; typing a query flattens
 *  results across every category. */
export function EmojiPicker({ onSelect, className }: EmojiPickerProps) {
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

  return (
    <div
      className={cn(
        "flex h-emoji-panel-h w-emoji-panel flex-col overflow-hidden rounded-card bg-surface shadow-popover",
        className
      )}
      role="dialog"
      aria-label="Choose an emoji"
    >
      {/* Quiet pill search — no visible label or field chrome; the panel is
          already announced as "Choose an emoji", so aria-label carries the
          field name. The global :focus-visible ring lands on the pill
          itself. */}
      <div className="relative shrink-0 p-xs">
        <span className="pointer-events-none absolute inset-y-0 left-page flex items-center text-muted">
          <IconSearch size={16} stroke={1.75} aria-hidden="true" />
        </span>
        <input
          type="search"
          aria-label="Search emoji"
          placeholder="Search emoji"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 w-full rounded-pill border border-transparent bg-surface-2 pl-xl pr-sm text-ui-sm text-foreground placeholder:text-muted focus-visible:border-border-strong focus-visible:shadow-none focus-visible:outline-none"
        />
      </div>
      {results ? (
        <ScrollArea className="flex-1" viewportClassName="p-xs">
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
        </ScrollArea>
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
              <ScrollArea className="flex-1" viewportClassName="p-xs">
                <EmojiGroupList emojis={group.emojis} onSelect={onSelect} />
              </ScrollArea>
            </Tabs.Panel>
          ))}
          {/* Tab strip lives below the grid (thumb-reach on mobile) and
              distributes evenly — nine fixed categories, no horizontal
              scrolling. */}
          <Tabs.List className="flex shrink-0 border-t border-border bg-surface px-nudge py-2xs">
            {emojiGroups.map((group) => {
              const GroupIcon = groupIcons[group.name] ?? IconMoodSmile;
              return (
                <Tabs.Tab
                  key={group.slug}
                  value={group.slug}
                  aria-label={group.name}
                  className="group flex h-10 flex-1 items-center justify-center text-muted focus-visible:shadow-none focus-visible:outline-none data-[active]:text-foreground"
                >
                  {/* Circular highlight sized to fit inside the ~30px
                      flex-1 tab — a wider circle (or the global focus
                      ring on the full tab rect) clips against the
                      panel's overflow-hidden edge on the first/last
                      tab. Focus ring renders on the circle instead. */}
                  <span className="flex size-7 items-center justify-center rounded-pill group-hover:bg-surface-2 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus-outer group-data-[active]:bg-surface-2">
                    <GroupIcon size={18} stroke={1.75} aria-hidden="true" />
                  </span>
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs.Root>
      )}
    </div>
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
            className="flex size-10 items-center justify-center rounded-control hover:bg-surface-2"
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

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  label: string;
  className?: string;
  children?: ReactNode;
}

/** Self-contained popover trigger — an icon button (default smiley) that
 *  opens the grouped/searchable EmojiPicker panel in a Base UI Popover
 *  (portaled to <body>, collision-aware flip/align, Escape + outside-click
 *  dismiss, and focus return handled for free). Closes on selecting an
 *  emoji. */
export function EmojiPickerButton({
  onSelect,
  label,
  className,
  children,
}: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={label} className={className}>
        {children ?? (
          <IconMoodSmile size={18} stroke={1.75} aria-hidden="true" />
        )}
      </Popover.Trigger>
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
