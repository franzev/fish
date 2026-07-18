"use client";

import {
  ActionMenuItem,
  ActionMenuPopup,
  ActionMenuRoot,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import type { PendingChatImage } from "@/features/chat/hooks/use-chat-image-uploads";
import { cn } from "@/lib/utils";
import { IconAlertCircle, IconFileText, IconRefresh, IconTrash, IconX } from "@tabler/icons-react";

interface ImageUploadPreviewProps {
  images: PendingChatImage[];
  onRemove: (clientUploadId: string) => void;
  onRetry: (clientUploadId: string) => void;
}

const statusLabel = {
  preparing: "Preparing",
  uploading: "Uploading",
  processing: "Checking",
} as const;

export function ImageUploadPreview({ images, onRemove, onRetry }: ImageUploadPreviewProps) {
  if (images.length === 0) return null;
  return (
    <ul aria-label="Files to send" className="flex flex-wrap justify-start gap-xs px-xs pt-xs">
      {images.map((image) => {
        const pendingLabel = image.status === "ready" || image.status === "failed"
          ? null
          : statusLabel[image.status];
        const isPending = pendingLabel !== null;
        return (
          <li
            key={image.clientUploadId}
            className="w-chat-image-preview shrink-0"
          >
            <div className={cn(
              "relative aspect-square overflow-hidden rounded-control border bg-surface",
              image.status === "failed" ? "border-notice" : "border-transparent"
            )}>
              {image.kind === "image" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={image.previewUrl}
                  alt="Preview of image to send"
                  className={cn(
                    "size-full object-cover",
                    isPending && "opacity-70"
                  )}
                />
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-2xs px-xs text-center text-muted">
                  <IconFileText size={28} stroke={1.5} aria-hidden="true" />
                  <span className="w-full truncate text-ui-xs">{image.file.name}</span>
                </span>
              )}
              {isPending && (
                <Progress
                  value={image.progress * 100}
                  label={`${pendingLabel} file`}
                  labelVisuallyHidden
                  density="compact"
                  className="absolute inset-x-0 bottom-0"
                />
              )}
              {image.status === "failed" ? (
                <ActionMenuRoot modal={false}>
                  <ActionMenuTrigger
                    render={
                      <IconButton
                        label={`Upload failed for ${image.file.name}. Show options`}
                        appearance="overlay"
                        tone="notice"
                        tooltip={false}
                        className="absolute inset-0 size-full min-h-0 rounded-none"
                        icon={<IconAlertCircle size={20} stroke={1.75} aria-hidden="true" />}
                      />
                    }
                  />
                  <ActionMenuPopup side="top" width="content" positionerClassName="z-30">
                        <ActionMenuItem
                          onClick={() => onRetry(image.clientUploadId)}
                        >
                          <IconRefresh size={20} stroke={1.75} aria-hidden="true" />
                          Retry
                        </ActionMenuItem>
                        <ActionMenuItem
                          onClick={() => onRemove(image.clientUploadId)}
                          className="text-body"
                        >
                          <IconTrash size={20} stroke={1.75} aria-hidden="true" />
                          Remove
                        </ActionMenuItem>
                  </ActionMenuPopup>
                </ActionMenuRoot>
              ) : (
                <IconButton
                  label={`Remove ${image.file.name || "file"}`}
                  appearance="ghost"
                  tooltip={false}
                  onClick={() => onRemove(image.clientUploadId)}
                  className="absolute right-3xs top-3xs items-start justify-end p-2xs text-body"
                  icon={
                    <span className="inline-flex size-lg items-center justify-center rounded-pill bg-surface">
                      <IconX size={20} stroke={1.75} aria-hidden="true" />
                    </span>
                  }
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
