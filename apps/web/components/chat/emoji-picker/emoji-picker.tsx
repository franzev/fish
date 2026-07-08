"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input/input";
import { IconMoodSmile, IconSearch } from "@tabler/icons-react";
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
        "flex h-emoji-panel-h w-emoji-panel flex-col overflow-hidden rounded-card border border-border bg-surface",
        className
      )}
      role="dialog"
      aria-label="Choose an emoji"
    >
      <div className="sticky top-0 z-10 border-b border-border bg-surface p-xs">
        <Input
          label="Search emoji"
          placeholder="Search emoji"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          reserveMessageSpace={false}
          trailingControl={
            <IconSearch
              size={18}
              stroke={1.75}
              aria-hidden="true"
              className="text-muted"
            />
          }
        />
      </div>
      {results ? (
        <div className="flex-1 overflow-y-auto p-xs">
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
        </div>
      ) : (
        <Tabs.Root
          defaultValue={emojiGroups[0]?.slug}
          className="flex min-h-0 flex-1 flex-col"
        >
          <Tabs.List className="flex shrink-0 gap-2xs overflow-x-auto border-b border-border bg-surface p-xs">
            {emojiGroups.map((group) => (
              <Tabs.Tab
                key={group.slug}
                value={group.slug}
                aria-label={group.name}
                className="flex size-10 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 data-[active]:bg-surface-2 data-[active]:text-foreground"
              >
                <span aria-hidden="true" className="text-copy leading-none">
                  {group.emojis[0]?.emoji}
                </span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {emojiGroups.map((group) => (
            <Tabs.Panel
              key={group.slug}
              value={group.slug}
              className="flex-1 overflow-y-auto p-xs"
            >
              <EmojiGroupList emojis={group.emojis} onSelect={onSelect} />
            </Tabs.Panel>
          ))}
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
            <span aria-hidden="true" className="text-copy leading-none">
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
          <Popover.Popup>
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
