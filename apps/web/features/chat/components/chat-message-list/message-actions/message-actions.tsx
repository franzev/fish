"use client";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import {
  IconArrowBackUp,
  IconDots,
  IconFlag,
  IconMessageReply,
  IconMoodPlus,
  IconMoodSmile,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { EmojiPicker, EmojiPickerButton } from "../../emoji-picker";

export interface MessageActionResult {
  ok: boolean;
  notice?: string;
}

export interface MessageActionsProps {
  mine: boolean;
  layout: "direct" | "community";
  canEdit: boolean;
  canDelete: boolean;
  canReportGif: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => Promise<MessageActionResult>;
  onReportGif: () => void;
}

type MoreView = "actions" | "reactions" | "delete";

const popoverActionClass =
  "flex min-h-control w-full items-center gap-sm rounded-control px-sm text-left text-ui-sm text-foreground hover:bg-surface-2";

/** Progressive message actions: relevant shortcuts for fine pointers, with
 *  every action available behind one persistent touch-friendly trigger. */
export function MessageActions({
  mine,
  layout,
  canEdit,
  canDelete,
  canReportGif,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onReportGif,
}: MessageActionsProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MoreView>("actions");
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  function closeMore() {
    setOpen(false);
    setView("actions");
    setDeleting(false);
    setDeleteNotice(null);
  }

  function selectAction(action: () => void) {
    closeMore();
    action();
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteNotice(null);

    const result = await onDelete().catch(() => ({
      ok: false,
      notice: "That didn’t delete yet. Keep this open and try again.",
    }));

    if (result.ok) {
      closeMore();
      return;
    }

    setDeleting(false);
    setDeleteNotice(
      result.notice ?? "That didn’t delete yet. Keep this open and try again."
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 flex h-fit items-center gap-3xs rounded-control border border-divider bg-surface p-3xs opacity-0 transition-opacity",
        layout === "community"
          ? "-top-sm right-md"
          : cn(
              "inset-y-0 my-auto",
              mine ? "right-full mr-xs" : "left-full ml-xs"
            ),
        "focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100",
        "pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
        open && "pointer-events-auto opacity-100"
      )}
    >
      {!mine && (
        <IconButton
          label="Reply to message"
          appearance="ghost"
          tooltip
          onClick={onReply}
          className="pointer-coarse:hidden"
          icon={<IconMessageReply size={20} stroke={1.75} aria-hidden="true" />}
        />
      )}
      <EmojiPickerButton
        label="Add a reaction"
        onSelect={onReact}
        className="pointer-coarse:hidden"
      >
        {layout === "community" ? (
          <IconMoodPlus size={20} stroke={1.75} aria-hidden="true" />
        ) : (
          <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />
        )}
      </EmojiPickerButton>
      {mine && canEdit && (
        <IconButton
          label="Edit message"
          appearance="ghost"
          tooltip
          onClick={onEdit}
          className="pointer-coarse:hidden"
          icon={<IconPencil size={20} stroke={1.75} aria-hidden="true" />}
        />
      )}
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setView("actions");
            setDeleting(false);
            setDeleteNotice(null);
          }
        }}
      >
        <Popover.Trigger
          render={
            <IconButton
              label="More actions for message"
              appearance="ghost"
              tooltip
              className={cn(
                !mine && !canReportGif && "pointer-fine:hidden"
              )}
              icon={<IconDots size={20} stroke={1.75} aria-hidden="true" />}
            />
          }
        />
        <Popover.Portal>
          <Popover.Positioner
            side="top"
            align="end"
            sideOffset={4}
            className="z-20"
          >
            <Popover.Popup
              initialFocus={false}
              aria-label="Message actions"
              className={cn(
                "overflow-hidden rounded-card border border-divider bg-surface",
                view === "reactions" ? "h-emoji-panel-h w-emoji-panel" : "w-menu p-3xs"
              )}
            >
              {view === "actions" && (
                <div role="group" aria-label="Message actions">
                  <button
                    type="button"
                    onClick={() => setView("reactions")}
                    className={cn(popoverActionClass, "pointer-fine:hidden")}
                  >
                    <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />
                    Add a reaction
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAction(onReply)}
                    className={cn(popoverActionClass, !mine && "pointer-fine:hidden")}
                  >
                    <IconMessageReply size={20} stroke={1.75} aria-hidden="true" />
                    Reply
                  </button>
                  {mine && canEdit && (
                    <button
                      type="button"
                      onClick={() => selectAction(onEdit)}
                      className={cn(popoverActionClass, "pointer-fine:hidden")}
                    >
                      <IconPencil size={20} stroke={1.75} aria-hidden="true" />
                      Edit message
                    </button>
                  )}
                  {canReportGif && (
                    <button
                      type="button"
                      onClick={() => selectAction(onReportGif)}
                      className={popoverActionClass}
                    >
                      <IconFlag size={20} stroke={1.75} aria-hidden="true" />
                      Report GIF
                    </button>
                  )}
                  {mine && canDelete && (
                    <div className="mt-2xs border-t border-divider pt-2xs">
                      <button
                        type="button"
                        onClick={() => setView("delete")}
                        className={cn(popoverActionClass, "text-notice")}
                      >
                        <IconTrash size={20} stroke={1.75} aria-hidden="true" />
                        Delete message
                      </button>
                    </div>
                  )}
                </div>
              )}

              {view === "reactions" && (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex min-h-control shrink-0 items-center gap-xs border-b border-divider px-xs">
                    <IconButton
                      label="Back to message actions"
                      appearance="ghost"
                      tooltip
                      onClick={() => setView("actions")}
                      icon={
                        <IconArrowBackUp
                          size={20}
                          stroke={1.75}
                          aria-hidden="true"
                        />
                      }
                    />
                    <p className="text-ui-sm font-medium text-foreground">
                      Add a reaction
                    </p>
                  </div>
                  <EmojiPicker
                    embedded
                    onSelect={(emoji) => selectAction(() => onReact(emoji))}
                    className="flex-1"
                  />
                </div>
              )}

              {view === "delete" && (
                <div className="p-xs">
                  <p className="text-ui-sm font-medium text-foreground">
                    Delete this message?
                  </p>
                  <p className="mt-2xs text-ui-xs text-body">
                    It will remain in the conversation as Message deleted.
                  </p>
                  <p
                    role="status"
                    aria-live="polite"
                    className="min-h-field-message pt-xs text-ui-xs text-notice"
                  >
                    {deleteNotice}
                  </p>
                  <div className="flex flex-col gap-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      fullWidth
                      disabled={deleting}
                      onClick={() => {
                        setView("actions");
                        setDeleteNotice(null);
                      }}
                      className="text-body"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      fullWidth
                      loading={deleting}
                      onClick={() => void confirmDelete()}
                      className="text-body"
                    >
                      Delete message
                    </Button>
                  </div>
                </div>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
