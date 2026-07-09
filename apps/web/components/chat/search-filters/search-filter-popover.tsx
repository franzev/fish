"use client";

import { Popover } from "@base-ui/react/popover";
import {
  Icon,
  IconAdjustmentsHorizontal,
  IconAt,
  IconHash,
  IconPaperclip,
  IconSearch,
  IconUser,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { FiltersDialog } from "./filters-dialog";

export interface SearchFilterPopoverProps {
  /** Controlled search text — drives the live message filter upstream. */
  value: string;
  onValueChange: (value: string) => void;
}

interface QuickFilter {
  icon: Icon;
  title: string;
  /** Prefix appended into the search text, e.g. `from:`. */
  token: string;
  /** One-line usage hint under the title. */
  hint: string;
}

const quickFilters: QuickFilter[] = [
  {
    icon: IconUser,
    title: "From a specific user",
    token: "from:",
    hint: "from: user",
  },
  {
    icon: IconHash,
    title: "Sent in a specific channel",
    token: "in:",
    hint: "in: channel",
  },
  {
    icon: IconPaperclip,
    title: "Includes a specific type of data",
    token: "has:",
    hint: "has: link, image, file",
  },
  {
    icon: IconAt,
    title: "Mentions a specific user",
    token: "mentions:",
    hint: "mentions: user",
  },
];

const quickFilterItemClass =
  "flex min-h-control w-full items-center gap-sm rounded-control px-sm text-left hover:bg-surface-2";

/** The chat header's search field: a compact, always-visible input — no
 *  popover to open before typing — paired with a quiet filters trigger that
 *  holds quick-filter shortcuts (dropping `from:`-style tokens into the
 *  query) and the full Filters dialog. UI stub for now: the tokens land in
 *  the search text; real token-aware filtering ships with the search
 *  feature. */
export function SearchFilterPopover({
  value,
  onValueChange,
}: SearchFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Focus restore target for the Filters dialog: the popover (the dialog's
  // opener) unmounts when the dialog opens, so the dialog needs a surviving
  // element to return focus to on close.
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const appendToken = (token: string) => {
    onValueChange(`${value.trimEnd()} ${token} `.trimStart());
  };

  return (
    <>
      <div className="flex min-w-0 items-center gap-2xs">
        {/* Same quiet-well idiom as the emoji picker: no field chrome, focus
            lands as a border step on the well itself. Fixed compact width —
            this lives inline in the header now, not in its own panel. */}
        <div className="relative min-w-0 max-w-search-header flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-sm flex items-center text-muted">
            <IconSearch size={18} stroke={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            aria-label="Search messages"
            placeholder="Search"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className="h-10 w-full rounded-control border border-transparent bg-surface-2 pl-xl pr-sm text-ui-sm text-foreground placeholder:text-muted focus-visible:border-border-strong focus-visible:shadow-none focus-visible:outline-none"
          />
        </div>

        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger
            ref={triggerRef}
            aria-label="Search filters"
            className="inline-flex min-h-control min-w-control shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
          >
            <IconAdjustmentsHorizontal size={20} stroke={1.75} aria-hidden="true" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="end"
              sideOffset={4}
              className="z-20"
            >
              <Popover.Popup className="w-search-pop rounded-card border border-border bg-surface p-3xs shadow-popover">
                <p className="px-sm pb-2xs pt-xs text-ui-2xs font-medium uppercase tracking-wide text-muted">
                  Filters
                </p>
                {quickFilters.map((filter) => (
                  <button
                    key={filter.token}
                    type="button"
                    onClick={() => appendToken(filter.token)}
                    className={quickFilterItemClass}
                  >
                    <filter.icon
                      size={20}
                      stroke={1.75}
                      aria-hidden="true"
                      className="shrink-0 text-muted"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-ui-sm text-foreground">
                        {filter.title}
                      </span>
                      <span className="text-ui-xs text-muted">{filter.hint}</span>
                    </span>
                  </button>
                ))}
                <div className="mt-3xs border-t border-border pt-3xs">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setFiltersOpen(true);
                    }}
                    className={quickFilterItemClass}
                  >
                    <IconAdjustmentsHorizontal
                      size={20}
                      stroke={1.75}
                      aria-hidden="true"
                      className="shrink-0 text-muted"
                    />
                    <span className="text-ui-sm text-foreground">
                      More filters
                    </span>
                  </button>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        finalFocus={triggerRef}
      />
    </>
  );
}
