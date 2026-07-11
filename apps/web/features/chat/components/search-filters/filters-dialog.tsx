"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import type { RefObject } from "react";

/** UI stub: every field is inert and all three footer actions simply close
 *  the dialog — the filtering logic lands with the real search feature. */

export interface FiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus lands on close. The opener (the search popover) unmounts
   *  before this dialog closes, so Base UI's default restore target is a
   *  disconnected node — callers pass a surviving element instead. */
  finalFocus?: RefObject<HTMLElement | null>;
}

interface FilterField {
  label: string;
  description: string;
  placeholder: string;
}

const filterFields: FilterField[] = [
  {
    label: "From",
    description: "Messages sent by a person",
    placeholder: "Anyone",
  },
  {
    label: "In",
    description: "Messages sent in a channel",
    placeholder: "ex. general",
  },
  {
    label: "Has",
    description: "Messages that include links, images, or files",
    placeholder: "Any content",
  },
  {
    label: "Mentions",
    description: "Messages that mention a person",
    placeholder: "Anyone",
  },
];

/** Full filter sheet behind the popover's "More filters" — a bottom sheet on
 *  small screens that becomes a centered dialog on md+. */
export function FiltersDialog({
  open,
  onOpenChange,
  finalFocus,
}: FiltersDialogProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-scrim" />
        {/* Centering without translate positioning (the design-token guard
            forbids left-1/2-style offsets): on md+ the popup spans inset-0
            with a fixed width, fit height, and auto margins — the absolute
            -centering idiom — while small screens keep it docked to the
            bottom edge as a sheet. */}
        <Dialog.Popup
          finalFocus={finalFocus}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-filters-sheet flex-col overflow-hidden rounded-t-card border border-border bg-surface md:inset-0 md:m-auto md:h-fit md:w-filters-dialog md:rounded-card"
        >
          <header className="flex items-center justify-between gap-sm border-b border-border px-md py-sm">
            <Dialog.Title className="text-heading-sm text-foreground">
              Filters
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close filters"
              className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
            >
              <IconX size={20} stroke={1.75} aria-hidden="true" />
            </Dialog.Close>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-md overflow-y-auto px-md py-md">
            {filterFields.map((field) => (
              <div key={field.label} className="flex flex-col gap-2xs">
                <p className="text-ui-sm font-semibold text-foreground">
                  {field.label}
                </p>
                <p className="text-ui-xs text-muted">{field.description}</p>
                <div className="flex min-h-control items-center justify-between rounded-control border border-border px-sm text-ui-sm text-muted">
                  <span>{field.placeholder}</span>
                  <span aria-hidden="true">▾</span>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2xs">
              <p className="text-ui-sm font-semibold text-foreground">Date</p>
              <p className="text-ui-xs text-muted">
                Messages sent in a time range
              </p>
              {/* Honest stub: a plain well like the four selects above — a
                  focusable button with no handler would be a dead end. */}
              <div className="flex min-h-control w-full items-center justify-center rounded-control bg-surface-2 text-ui-sm text-muted">
                + Add date
              </div>
            </div>
          </div>
          <footer className="flex items-center gap-sm border-t border-border px-md py-sm">
            <button
              type="button"
              onClick={close}
              className="min-h-control rounded-control px-xs text-ui-sm text-muted hover:text-body"
            >
              Clear filters
            </button>
            <span aria-hidden="true" className="flex-1" />
            <Button variant="ghost" fullWidth={false} onClick={close}>
              Cancel
            </Button>
            {/* The one primary action in this modal layer. */}
            <Button fullWidth={false} onClick={close}>
              Apply
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
