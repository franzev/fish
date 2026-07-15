"use client";

import { Progress } from "@/components/ui/progress";
import type { PendingChatImage } from "@/features/chat/hooks/use-chat-image-uploads";
import { cn } from "@/lib/utils";
import { Menu } from "@base-ui/react/menu";
import { IconAlertCircle, IconFileText, IconRefresh, IconTrash, IconX } from "@tabler/icons-react";

interface ImageUploadPreviewProps {
  images: PendingChatImage[];
  onRemove: (clientUploadId: string) => void;
  onRetry: (clientUploadId: string) => void;
}

const statusLabel = {
  preparing: "Preparing",
  uploading: "Uploading",
  processing: "Preparing",
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
                <Menu.Root modal={false}>
                  <Menu.Trigger
                    aria-label={`Upload failed for ${image.file.name}. Show options`}
                    className="icon-button-glyph absolute inset-0 flex size-full items-center justify-center bg-scrim text-notice"
                  >
                    <IconAlertCircle size={20} stroke={1.75} aria-hidden="true" />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner side="top" align="end" sideOffset={4} className="z-30">
                      <Menu.Popup className="w-max rounded-card border border-divider bg-surface p-3xs">
                        <Menu.Item
                          onClick={() => onRetry(image.clientUploadId)}
                          className="flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2"
                        >
                          <IconRefresh size={20} stroke={1.75} aria-hidden="true" />
                          Retry
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => onRemove(image.clientUploadId)}
                          className="flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-body data-[highlighted]:bg-surface-2"
                        >
                          <IconTrash size={20} stroke={1.75} aria-hidden="true" />
                          Remove
                        </Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              ) : (
                <button
                  type="button"
                  aria-label={`Remove ${image.file.name || "file"}`}
                  onClick={() => onRemove(image.clientUploadId)}
                  className="icon-button-glyph absolute right-3xs top-3xs inline-flex min-h-control min-w-control items-start justify-end rounded-control p-2xs text-body"
                >
                  <span className="inline-flex size-lg items-center justify-center rounded-pill bg-surface">
                    <IconX size={20} stroke={1.75} aria-hidden="true" />
                  </span>
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
