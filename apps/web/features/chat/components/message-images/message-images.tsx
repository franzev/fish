"use client";

import type { ClientChatImage } from "@/lib/services";
import { getChatImageService } from "@/lib/services/runtime/browser";
import { cn } from "@/lib/utils";
import { Dialog } from "@base-ui/react/dialog";
import { IconDownload, IconFileText, IconRefresh, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface MessageImagesProps {
  images: ClientChatImage[];
  authorName: string;
  mine: boolean;
}

const previewRevocationTimers = new Map<string, ReturnType<typeof setTimeout>>();

function MessageImage({
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
  const thumbnailState = refreshing
    ? "loading"
    : !thumbnailUrl
      ? urlRefreshFailed ? "failed" : "loading"
      : failedThumbnailUrl === thumbnailUrl
      ? "failed"
      : loadedThumbnailUrl === thumbnailUrl
        ? "loaded"
        : "loading";
  const displayState = refreshing
    ? "loading"
    : !displayUrl
      ? urlRefreshFailed ? "failed" : "loading"
      : failedDisplayUrl === displayUrl
      ? "failed"
      : loadedDisplayUrl === displayUrl
        ? "loaded"
        : "loading";
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
              <span className="absolute inset-0 animate-pulse bg-surface-2" aria-label="Loading image" />
            )}
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

function fileTypeLabel(mimeType = "application/octet-stream"): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/plain") return "Text file";
  if (mimeType === "text/csv") return "CSV";
  if (mimeType.includes("wordprocessingml")) return "Word document";
  if (mimeType.includes("spreadsheetml")) return "Excel workbook";
  if (mimeType.includes("presentationml")) return "PowerPoint presentation";
  return "File";
}

function formatFileSize(bytes = 0): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageFile({ file, mine }: { file: ClientChatImage; mine: boolean }) {
  const [url, setUrl] = useState(file.displayUrl);
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true);
    try {
      const refreshed = await getChatImageService().refreshUrls([file.id]);
      setUrl(refreshed.find((item) => item.path === file.displayPath)?.signedUrl);
    } finally { setRefreshing(false); }
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
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${file.originalName}`} className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-body hover:bg-surface">
          <IconDownload size={20} stroke={1.75} aria-hidden="true" />
        </a>
      ) : (
        <button type="button" disabled={refreshing} onClick={() => void refresh()} className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-body" aria-label={`Retry ${file.originalName}`}>
          <IconRefresh size={20} stroke={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function MessageImages({ images, authorName, mine }: MessageImagesProps) {
  if (images.length === 0) return null;
  const imageAttachments = images.filter((attachment) => attachment.kind !== "file");
  const fileAttachments = images.filter((attachment) => attachment.kind === "file");
  const wrapped = imageAttachments.length > 1;
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2xs",
        imageAttachments.length === 1 && "max-w-chat-preview",
        imageAttachments.length === 0 && "max-w-chat-image"
      )}
      aria-label={`${images.length} shared ${images.length === 1 ? "file" : "files"}`}
    >
      {imageAttachments.length > 0 && (
        <div
          data-image-layout={wrapped ? "wrap" : "single"}
          className="flex flex-wrap gap-nudge"
        >
          {imageAttachments.map((image) => (
            <MessageImage
              key={image.id}
              image={image}
              authorName={authorName}
              mine={mine}
              wrapped={wrapped}
            />
          ))}
        </div>
      )}
      {fileAttachments.map((file) => (
        <MessageFile key={file.id} file={file} mine={mine} />
      ))}
    </div>
  );
}
