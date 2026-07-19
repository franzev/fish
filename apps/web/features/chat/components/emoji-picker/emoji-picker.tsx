"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
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
import { Tabs } from "@base-ui/react/tabs";
import groups from "@fish/core/chat-media/emoji-groups.json";
import { useMemo, useState } from "react";
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

// Shared platform-neutral catalog generated from unicode-emoji-json — no CDN
// calls and identical search vocabulary on web and Android.
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
  const [activeGroup, setActiveGroup] = useState(emojiGroups[0]?.slug ?? "");

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
          value={activeGroup}
          onValueChange={setActiveGroup}
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
          <div className="shrink-0 border-t border-divider bg-surface">
            <p
              data-slot="emoji-category-label"
              className="px-sm pt-xs text-ui-xs text-body md:hidden"
            >
              {emojiGroups.find((group) => group.slug === activeGroup)?.name}
            </p>
            <IconTabStrip
              items={groupTabs}
              ariaLabel="Emoji category"
              className="border-t-0"
            />
          </div>
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
      <div className="grid grid-cols-5 gap-2xs sm:grid-cols-6">
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
