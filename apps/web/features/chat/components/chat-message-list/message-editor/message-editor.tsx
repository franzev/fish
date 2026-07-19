"use client";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { chatLimits } from "@fish/core/chat";
import { IconCheck, IconX } from "@tabler/icons-react";
import { resizeAutosizeTextarea } from "../../autosize-textarea";
import {
  useId,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";

export interface MessageEditorProps {
  originalBody: string;
  draft: string;
  notice: string | null;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Keeps message revision in transcript context, with an explicit save path
 *  for pointer and assistive-technology users plus familiar chat shortcuts. */
export function MessageEditor({
  originalBody,
  draft,
  notice,
  saving,
  onChange,
  onSave,
  onCancel,
}: MessageEditorProps) {
  const textareaId = useId();
  const hintId = useId();
  const noticeId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedDraft = draft.trim();
  const changed = trimmedDraft !== originalBody.trim();
  const tooLong = trimmedDraft.length > chatLimits.messageBodyMaxLength;
  const canSave = trimmedDraft.length > 0 && changed && !tooLong && !saving;
  const showsKeyboardShortcuts = trimmedDraft.length > 0 && changed && !tooLong;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    resizeAutosizeTextarea(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.scrollIntoView?.({ block: "nearest" });
  }, []);

  useLayoutEffect(() => {
    if (textareaRef.current) resizeAutosizeTextarea(textareaRef.current);
  }, [draft]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSave) onSave();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || saving) return;

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSave) onSave();
    }
  }

  const guidance = trimmedDraft.length === 0
    ? "Add some text before saving."
    : tooLong
      ? "This message is a little long. Try shortening it."
      : !changed
        ? "Make a change before saving."
        : "Enter to save · Shift+Enter for a new line · Esc to cancel";

  return (
    <form
      aria-busy={saving || undefined}
      onSubmit={submit}
      className="w-full rounded-card bg-surface-2 p-md"
    >
      <div className="mb-xs flex items-center justify-between gap-sm">
        <label
          htmlFor={textareaId}
          className="block text-ui-xs font-medium text-muted"
        >
          Edit message
        </label>
        <div className="flex shrink-0 gap-2xs">
          <IconButton
            type="button"
            appearance="ghost"
            disabled={saving}
            onClick={onCancel}
            label="Cancel"
            icon={<IconX size={20} stroke={1.75} aria-hidden="true" />}
          />
          <IconButton
            type="submit"
            disabled={!canSave}
            loading={saving}
            label="Save changes"
            appearance="solid"
            icon={<IconCheck size={20} stroke={1.75} aria-hidden="true" />}
          />
        </div>
      </div>
      <textarea
        ref={textareaRef}
        id={textareaId}
        aria-describedby={`${hintId} ${noticeId}`}
        aria-invalid={Boolean(notice) || undefined}
        value={draft}
        rows={1}
        disabled={saving}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        className="max-h-chat-composer-max-height min-h-control w-full resize-none rounded-control border-none bg-surface px-md py-field-y text-ui-md text-foreground outline-none md:text-ui-sm"
      />
      <p
        id={hintId}
        className={cn(
          "mt-xs text-ui-xs text-muted",
          showsKeyboardShortcuts && "pointer-coarse:hidden"
        )}
      >
        {guidance}
      </p>
      <p
        id={noticeId}
        role="status"
        aria-live="polite"
        className="min-h-field-message pt-2xs text-ui-xs text-notice"
      >
        {notice}
      </p>
    </form>
  );
}
