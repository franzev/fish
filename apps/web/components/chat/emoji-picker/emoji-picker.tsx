"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input/input";
import { IconMoodSmile, IconSearch } from "@tabler/icons-react";
import groups from "unicode-emoji-json/data-by-group.json";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

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
 *  ring already work without extra wiring. */
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
        "flex h-80 w-72 flex-col overflow-hidden rounded-card border border-border bg-surface",
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
      <div className="flex-1 overflow-y-auto p-xs">
        {results ? (
          results.length === 0 ? (
            <p className="p-xs text-ui-sm text-muted">
              No emoji match that yet.
            </p>
          ) : (
            <EmojiGroupList
              heading="Results"
              emojis={results}
              onSelect={onSelect}
            />
          )
        ) : (
          emojiGroups.map((group) => (
            <EmojiGroupList
              key={group.slug}
              heading={group.name}
              emojis={group.emojis}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmojiGroupList({
  heading,
  emojis,
  onSelect,
}: {
  heading: string;
  emojis: EmojiEntry[];
  onSelect: (emoji: string) => void;
}) {
  return (
    <div className="mb-sm">
      <p className="mb-2xs text-ui-xs text-muted">{heading}</p>
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
 *  opens the grouped/searchable EmojiPicker panel below it. Closes on
 *  selecting an emoji, pressing Escape, or clicking outside. */
export function EmojiPickerButton({
  onSelect,
  label,
  className,
  children,
}: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={className}
      >
        {children ?? (
          <IconMoodSmile size={18} stroke={1.75} aria-hidden="true" />
        )}
      </button>
      {open && (
        <EmojiPicker
          className="absolute right-0 top-full z-20 mt-2xs"
          onSelect={(emoji) => {
            onSelect(emoji);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
