"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input/input";
import { IconMoodSmile, IconSearch } from "@tabler/icons-react";
import groups from "unicode-emoji-json/data-by-group.json";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

/** Reads a pixel design token off :root, with a fallback for tests. */
function readPixelToken(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Fixed viewport coordinates for the panel, anchored to the trigger.
 *  The panel portals to <body>: chat triggers live inside overflow-y-auto
 *  message lists and hover-revealed action bars, where an absolutely
 *  positioned panel is clipped by the scrollport and stretches its scroll
 *  content. Opens upward when the trigger sits in the lower half of the
 *  viewport (in a chat the newest messages are at the bottom). */
function panelPositionFor(trigger: DOMRect): { top: number; left: number } {
  const width = readPixelToken("--spacing-emoji-panel", 288);
  const height = readPixelToken("--spacing-emoji-panel-h", 320);
  const gap = readPixelToken("--spacing-2xs", 4);
  const inset = readPixelToken("--spacing-xs", 8);
  // innerWidth/innerHeight can be 0 in embedded contexts — fall back to the
  // document's client box.
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  const openUp = trigger.top + trigger.height / 2 > viewportHeight / 2;
  const alignRight = trigger.left + trigger.width / 2 > viewportWidth / 2;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

  return {
    top: clamp(
      openUp ? trigger.top - height - gap : trigger.bottom + gap,
      inset,
      viewportHeight - height - inset
    ),
    left: clamp(
      alignRight ? trigger.right - width : trigger.left,
      inset,
      viewportWidth - width - inset
    ),
  };
}

/** Self-contained popover trigger — an icon button (default smiley) that
 *  opens the grouped/searchable EmojiPicker panel in a body portal beside
 *  it. Closes on selecting an emoji, pressing Escape, clicking outside, or
 *  scrolling the conversation. */
export function EmojiPickerButton({
  onSelect,
  label,
  className,
  children,
}: EmojiPickerButtonProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = position !== null;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setPosition(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPosition(null);
    }
    function handleScroll(event: Event) {
      // The panel anchors to a viewport point; scrolling the thread would
      // detach it from its trigger, so close calmly. Scrolls inside the
      // panel's own emoji list keep it open.
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) {
        return;
      }
      setPosition(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="inline-block">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          const rect = containerRef.current?.getBoundingClientRect();
          setPosition((value) => (value || !rect ? null : panelPositionFor(rect)));
        }}
        className={className}
      >
        {children ?? (
          <IconMoodSmile size={18} stroke={1.75} aria-hidden="true" />
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-20"
            style={{ top: position.top, left: position.left }}
          >
            <EmojiPicker
              onSelect={(emoji) => {
                onSelect(emoji);
                setPosition(null);
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
