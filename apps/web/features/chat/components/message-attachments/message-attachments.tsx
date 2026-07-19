"use client";

import { IconButton } from "@/components/ui/icon-button";
import type { ClientChatImage } from "@/lib/services";
import { getChatImageService } from "@/lib/services/runtime/browser";
import { cn } from "@/lib/utils";
import { Dialog } from "@base-ui/react/dialog";
import { IconDownload, IconFileText, IconRefresh, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachmentRuns,
  fileTypeLabel,
  formatFileSize,
} from "./attachment-runs";
import { deriveImageLoadState } from "./image-load-state";

interface MessageAttachmentsProps {
  images: ClientChatImage[];
  authorName: string;
  mine: boolean;
}

const previewRevocationTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function MessageImage({
  image,
  authorName,
  mine,
  wrapped = false,
}: {
  image: ClientChatImage;
  authorName: string;
  mine: boolean;
  wrapped?: boolean;
}) {
  const width = image.width ?? 1;
  const height = image.height ?? 1;
  const previewAspectRatio = wrapped
    ? Math.min(2, Math.max(2 / 3, width / height))
    : width / height;
  const [localPreviewUrl] = useState(() =>
    image.thumbnailUrl?.startsWith("blob:") ? image.thumbnailUrl : undefined
  );
  const [refreshedThumbnailUrl, setRefreshedThumbnailUrl] = useState<string>();
  const [refreshedDisplayUrl, setRefreshedDisplayUrl] = useState<string>();
  const [loadedThumbnailUrl, setLoadedThumbnailUrl] = useState<string>();
  const [loadedDisplayUrl, setLoadedDisplayUrl] = useState<string>();
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string>();
  const [failedDisplayUrl, setFailedDisplayUrl] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [urlRefreshFailed, setUrlRefreshFailed] = useState(false);
  const attemptedInitialRefresh = useRef(false);
  // The sender already decoded this local object URL in the composer. Keep it
  // for the lifetime of the optimistic row instead of downloading the same
  // image again immediately after send.
  const thumbnailUrl = localPreviewUrl ?? refreshedThumbnailUrl ?? image.thumbnailUrl;
  const displayUrl = localPreviewUrl ?? refreshedDisplayUrl ?? image.displayUrl;
  const thumbnailState = deriveImageLoadState({
    refreshing,
    url: thumbnailUrl,
    loadedUrl: loadedThumbnailUrl,
    failedUrl: failedThumbnailUrl,
    urlRefreshFailed,
  });
  const displayState = deriveImageLoadState({
    refreshing,
    url: displayUrl,
    loadedUrl: loadedDisplayUrl,
    failedUrl: failedDisplayUrl,
    urlRefreshFailed,
  });
  const progressivelyLoads = Boolean(
    displayUrl && thumbnailUrl && displayUrl !== thumbnailUrl
  );

  const refreshUrls = useCallback(async () => {
    setRefreshing(true);
    setUrlRefreshFailed(false);
    try {
      const refreshed = await getChatImageService().refreshUrls([image.id]);
      const urls = new Map(refreshed.map((item) => [item.path, item.signedUrl]));
      const nextThumbnail = image.thumbnailPath ? urls.get(image.thumbnailPath) : undefined;
      const nextDisplay = urls.get(image.displayPath);
      if (!nextThumbnail || !nextDisplay) {
        throw new Error("Image URLs are unavailable");
      }
      setLoadedThumbnailUrl(undefined);
      setLoadedDisplayUrl(undefined);
      setFailedThumbnailUrl(undefined);
      setFailedDisplayUrl(undefined);
      setRefreshedThumbnailUrl(nextThumbnail);
      setRefreshedDisplayUrl(nextDisplay);
    } catch {
      setUrlRefreshFailed(true);
      setFailedThumbnailUrl(thumbnailUrl);
      setFailedDisplayUrl(displayUrl);
    } finally {
      setRefreshing(false);
    }
  }, [displayUrl, image.displayPath, image.id, image.thumbnailPath, thumbnailUrl]);

  useEffect(() => {
    if (thumbnailUrl || attemptedInitialRefresh.current) return;
    attemptedInitialRefresh.current = true;
    void refreshUrls();
  }, [refreshUrls, thumbnailUrl]);

  useEffect(() => {
    if (!localPreviewUrl) return;
    const pending = previewRevocationTimers.get(localPreviewUrl);
    if (pending) clearTimeout(pending);
    previewRevocationTimers.delete(localPreviewUrl);
    return () => {
      const timer = setTimeout(() => {
        URL.revokeObjectURL(localPreviewUrl);
        previewRevocationTimers.delete(localPreviewUrl);
      }, 30_000);
      previewRevocationTimers.set(localPreviewUrl, timer);
    };
  }, [localPreviewUrl]);

  const previewContent = (
    <>
      {thumbnailUrl && (
        /* Supabase already serves this immutable private variant through its CDN. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbnailUrl}
          alt={`Image shared by ${authorName}`}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedThumbnailUrl(thumbnailUrl)}
          onError={() => setFailedThumbnailUrl(thumbnailUrl)}
          className={cn(
            "size-full object-cover transition-image-load duration-message",
            thumbnailState === "loaded" &&
              !(progressivelyLoads && displayState === "loaded")
              ? "opacity-100"
              : "opacity-0",
            progressivelyLoads && displayState === "loading" &&
              "scale-110 blur-md"
          )}
          data-image-quality={progressivelyLoads ? "preview" : "full"}
        />
      )}
      {progressivelyLoads && displayUrl && (
        /* The private display variant fades over the intentionally blurred LQIP. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={displayUrl}
          alt=""
          aria-hidden="true"
          width={width}
          height={height}
          decoding="async"
          onLoad={() => setLoadedDisplayUrl(displayUrl)}
          onError={() => setFailedDisplayUrl(displayUrl)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-message",
            displayState === "loaded" ? "opacity-100" : "opacity-0"
          )}
          data-image-quality="full"
        />
      )}
      {thumbnailState === "loading" && (
        <span
          className="absolute inset-0 animate-pulse bg-surface-2"
          aria-label="Loading image"
        />
      )}
    </>
  );

  return (
    <Dialog.Root>
      <div
        className={cn(
          "relative block overflow-hidden rounded-control bg-surface-2 text-left",
          wrapped
            ? "max-h-chat-image-preview w-auto max-w-full shrink-0"
            : "w-full max-h-chat-image-max-height max-w-chat-image",
          mine && "bg-surface-3"
        )}
        style={{
          aspectRatio: previewAspectRatio,
          ...(wrapped
            ? { width: `calc(var(--spacing-chat-image-preview) * ${previewAspectRatio})` }
            : {}),
        }}
      >
        {thumbnailState === "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-xs p-sm text-center text-ui-xs text-muted">
            Image unavailable
            <button
              type="button"
              onClick={() => void refreshUrls()}
              className="inline-flex min-h-control items-center gap-2xs rounded-control px-xs text-body underline"
            >
              <IconRefresh size={16} stroke={1.75} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : (
          <Dialog.Trigger
            aria-label={`Open image shared by ${authorName}`}
            className="absolute inset-0 block size-full"
          >
            {previewContent}
          </Dialog.Trigger>
        )}
      </div>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Popup className="fixed inset-0 z-50 m-auto flex h-fit max-h-filters-sheet w-full max-w-image-viewer flex-col p-md outline-none">
          <Dialog.Title className="sr-only">Image shared by {authorName}</Dialog.Title>
          <div className="relative flex min-h-control items-center justify-center overflow-hidden rounded-card bg-bg">
            <Dialog.Close
              aria-label="Close image"
              className="absolute right-sm top-sm z-10 inline-flex min-h-control min-w-control items-center justify-center rounded-control bg-surface text-body"
            >
              <IconX size={20} stroke={1.75} aria-hidden="true" />
            </Dialog.Close>
            {displayUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={displayUrl}
                alt={`Image shared by ${authorName}`}
                width={width}
                height={height}
                decoding="async"
                onLoad={() => setLoadedDisplayUrl(displayUrl)}
                onError={() => setFailedDisplayUrl(displayUrl)}
                className={cn(
                  "max-h-filters-sheet h-auto w-auto max-w-full object-contain transition-opacity duration-message",
                  displayState === "loaded" ? "opacity-100" : "opacity-0"
                )}
              />
            )}
            {displayState === "loading" && <span className="absolute inset-0 animate-pulse bg-surface-2" />}
            {displayState === "failed" && (
              <div className="flex min-h-control flex-col items-center justify-center gap-sm p-xl text-center text-body">
                <p>Image unavailable</p>
                <button type="button" onClick={() => void refreshUrls()} className="min-h-control rounded-control px-sm underline">
                  Try again
                </button>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MessageFile({ file, mine }: { file: ClientChatImage; mine: boolean }) {
  const [refreshing, setRefreshing] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  async function openFresh() {
    setRefreshing(true);
    setOpenFailed(false);
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const refreshed = await getChatImageService().refreshUrls([file.id]);
      const freshUrl = refreshed.find((item) => item.path === file.displayPath)?.signedUrl;
      if (!freshUrl) throw new Error("File URL is unavailable");
      if (popup) popup.location.replace(freshUrl);
      else {
        const anchor = document.createElement("a");
        anchor.href = freshUrl;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.click();
      }
    } catch {
      popup?.close();
      setOpenFailed(true);
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className={cn("flex min-h-control items-center gap-sm rounded-control bg-surface-2 p-xs", mine && "bg-surface-3")}>
      <span className="flex min-h-control min-w-control items-center justify-center rounded-control bg-surface text-muted">
        <IconFileText size={24} stroke={1.5} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui-sm text-foreground">{file.originalName}</span>
        <span className="block text-ui-xs text-muted">{fileTypeLabel(file.mimeType)} · {formatFileSize(file.byteSize)}</span>
      </span>
      <IconButton
        label={`${openFailed ? "Retry" : "Open"} ${file.originalName}`}
        appearance="ghost"
        disabled={refreshing}
        onClick={() => void openFresh()}
        className="text-body"
        icon={openFailed
          ? <IconRefresh size={20} stroke={1.75} aria-hidden="true" />
          : <IconDownload size={20} stroke={1.75} aria-hidden="true" />}
      />
    </div>
  );
}

export function MessageAttachments({ images, authorName, mine }: MessageAttachmentsProps) {
  if (images.length === 0) return null;
  const runs = attachmentRuns(images);
  const fileCount = images.filter((attachment) => attachment.kind === "file").length;
  const photoCount = images.length - fileCount;
  const sharedLabel = fileCount === 0
    ? `${photoCount} shared ${photoCount === 1 ? "photo" : "photos"}`
    : photoCount === 0
      ? `${fileCount} shared ${fileCount === 1 ? "file" : "files"}`
      : `${images.length} shared attachments`;
  const onlyImageRun = runs.length === 1 && runs[0]?.kind === "images"
    ? runs[0].items
    : null;
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2xs",
        onlyImageRun?.length === 1 && "max-w-chat-preview",
        !images.some((attachment) => attachment.kind !== "file") && "max-w-chat-image"
      )}
      aria-label={sharedLabel}
    >
      {runs.map((run) => {
        if (run.kind === "file") {
          return <MessageFile key={run.item.id} file={run.item} mine={mine} />;
        }
        const wrapped = run.items.length > 1;
        return (
          <div
            key={`images-${run.items[0]?.id}`}
            data-image-layout={wrapped ? "wrap" : "single"}
            className={cn(
              "flex flex-wrap gap-nudge",
              mine ? "justify-end" : "justify-start"
            )}
          >
            {run.items.map((image) => (
              <MessageImage
                key={image.id}
                image={image}
                authorName={authorName}
                mine={mine}
                wrapped={wrapped}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
