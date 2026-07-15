"use client";

import type { ClientChatGif } from "@/lib/services";
import { cn } from "@/lib/utils";
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { useState, useSyncExternalStore } from "react";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface GifMediaProps {
  gif: ClientChatGif;
  preview?: boolean;
  allowPlaybackControl?: boolean;
  paused?: boolean;
  playRequested?: boolean;
  fixedAspect?: boolean;
  className?: string;
}

/** Lightweight looping video rendition with a static poster for loading,
 *  failures, and reduced-motion users. */
export function GifMedia({
  gif,
  preview = false,
  allowPlaybackControl = false,
  paused: externallyPaused = false,
  playRequested: externalPlayRequested = false,
  fixedAspect = false,
  className,
}: GifMediaProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
  const [localPlayRequested, setLocalPlayRequested] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const shouldPlay = !externallyPaused
    && !paused
    && (!reducedMotion || localPlayRequested || externalPlayRequested);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-control bg-surface-2",
        fixedAspect && "aspect-gif-tile",
        className
      )}
      style={fixedAspect ? undefined : { aspectRatio: `${gif.width} / ${gif.height}` }}
    >
      {posterFailed ? (
        <span className="absolute inset-0 flex items-center justify-center p-sm text-center text-ui-sm text-muted">
          GIF no longer available
        </span>
      ) : failed || !shouldPlay ? (
        // Provider posters are a required static rendition, not decorative.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gif.posterUrl}
          alt={gif.description}
          width={gif.width}
          height={gif.height}
          loading={preview ? "eager" : "lazy"}
          decoding="async"
          onError={() => setPosterFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <video
          aria-label={gif.description}
          src={preview ? gif.previewUrl : gif.mediaUrl}
          poster={gif.posterUrl}
          width={gif.width}
          height={gif.height}
          autoPlay
          loop
          muted
          playsInline
          preload={preview ? "metadata" : "none"}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
      {allowPlaybackControl && !failed && !posterFailed && (
        <button
          type="button"
          aria-label={`${shouldPlay ? "Pause" : "Play"} GIF: ${gif.description}`}
          onClick={() => {
            if (shouldPlay) {
              setPaused(true);
              return;
            }
            setPaused(false);
            setLocalPlayRequested(true);
          }}
          className="icon-button-glyph absolute bottom-xs right-xs flex size-control items-center justify-center rounded-pill bg-scrim text-foreground"
        >
          {shouldPlay ? (
            <IconPlayerPause size={20} stroke={1.75} aria-hidden="true" />
          ) : (
            <IconPlayerPlay size={20} stroke={1.75} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
