"use client";

import { cn } from "@/lib/utils";
import {
  IconArrowForward,
  IconCopy,
  IconMessageReply,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { HTMLAttributes } from "react";

interface MessageActionsProps extends HTMLAttributes<HTMLDivElement> {
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onForward?: () => void;
}

/** Icon-only action row shown on hover/focus of a message (copy/edit/delete/
 *  reply/forward). Every button is a real focusable control with an
 *  aria-label — icons alone are never the only cue. Delete uses the calm
 *  `text-notice` tone, never an alarming red chrome slab (AGENTS.md rule 6). */
export function MessageActions({
  onCopy,
  onEdit,
  onDelete,
  onReply,
  onForward,
  className,
  ...props
}: MessageActionsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-control border border-border bg-surface p-1 shadow-[var(--shadow-card)]",
        className
      )}
      {...props}
    >
      <button
        type="button"
        aria-label="Reply"
        onClick={onReply}
        className="inline-flex min-h-[var(--size-control)] min-w-[var(--size-control)] items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
      >
        <IconMessageReply size={20} stroke={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Forward"
        onClick={onForward}
        className="inline-flex min-h-[var(--size-control)] min-w-[var(--size-control)] items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
      >
        <IconArrowForward size={20} stroke={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Copy"
        onClick={onCopy}
        className="inline-flex min-h-[var(--size-control)] min-w-[var(--size-control)] items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
      >
        <IconCopy size={20} stroke={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Edit"
        onClick={onEdit}
        className="inline-flex min-h-[var(--size-control)] min-w-[var(--size-control)] items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
      >
        <IconPencil size={20} stroke={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Delete"
        onClick={onDelete}
        className="inline-flex min-h-[var(--size-control)] min-w-[var(--size-control)] items-center justify-center rounded-control text-notice transition-colors hover:bg-surface-2"
      >
        <IconTrash size={20} stroke={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
