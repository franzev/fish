"use client";

import { Card } from "@/components/ui/card";
import { useGifReducedMotion } from "@/features/chat/hooks/use-gif-reduced-motion";
import { gifProvider, type GifProvider } from "@/features/chat/model/gif-provider";
import type { ClientChatGif } from "@/lib/services";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { GifMedia } from "../gif-media";
import { MediaPickerScrollArea } from "../media-picker-scroll-area";
import { MediaPickerSearch } from "../media-picker-search";

type PickerStatus = "loading" | "ready" | "empty" | "notice";

interface GifPickerProps {
  onSelect: (gif: ClientChatGif, query: string) => void;
  provider?: GifProvider;
  className?: string;
  embedded?: boolean;
}

export function GifPicker({
  onSelect,
  provider = gifProvider,
  className,
  embedded = false,
}: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<ClientChatGif[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<PickerStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const reducedMotion = useGifReducedMotion();
  const [animationPreference, setAnimationPreference] = useState<boolean | null>(null);
  const animationsPaused = animationPreference ?? reducedMotion;
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (cursor: string | null = null) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const sequence = ++requestSequence.current;
    const trimmedQuery = query.trim();
    if (!cursor) setStatus("loading");
    else setLoadingMore(true);
    try {
      const page = trimmedQuery
        ? await provider.search({ query: trimmedQuery, cursor, signal: controller.signal })
        : await provider.trending({ cursor, signal: controller.signal });
      if (sequence !== requestSequence.current) return;
      setGifs((current) => cursor ? [...current, ...page.gifs] : page.gifs);
      setNext(page.next);
      setStatus(page.gifs.length === 0 && !cursor ? "empty" : "ready");
    } catch {
      if (sequence !== requestSequence.current) return;
      if (!cursor) setGifs([]);
      setStatus("notice");
    } finally {
      if (sequence === requestSequence.current) setLoadingMore(false);
    }
  }, [provider, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), query ? 300 : 0);
    return () => {
      window.clearTimeout(timeout);
      activeRequest.current?.abort();
      requestSequence.current += 1;
    };
  }, [load, query]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !next || status !== "ready" || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void load(next);
    }, { rootMargin: "120px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [load, loadingMore, next, status]);

  const resultLabel = query.trim() ? `GIF results for ${query.trim()}` : "Trending GIFs";
  const PickerRoot = embedded ? "div" : Card;

  return (
    <PickerRoot
      role={embedded ? "region" : "dialog"}
      aria-label={embedded ? "Browse GIFs" : "Choose a GIF"}
      className={cn(
        "flex flex-col overflow-hidden bg-surface",
        embedded
          ? "h-full min-h-0 w-full"
          : "h-gif-panel-h w-gif-panel border border-divider p-0",
        className
      )}
    >
      <MediaPickerSearch
        id="gif-search"
        label="Search GIFs"
        placeholder="Search KLIPY"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <MediaPickerScrollArea viewportClassName="flex flex-col">
        {status === "loading" && (
          <p className="mb-xs text-ui-xs text-muted" role="status" aria-live="polite">
            Finding GIFs…
          </p>
        )}
        {status === "ready" && (
          <div className="mb-xs flex items-center justify-between gap-xs">
            <p className="text-ui-xs text-muted" role="status" aria-live="polite">
              {resultLabel}
            </p>
            <button
              type="button"
              aria-pressed={animationsPaused}
              onClick={() => setAnimationPreference(!animationsPaused)}
              className="min-h-target-touch rounded-control px-xs text-ui-xs text-muted hover:bg-surface-2 hover:text-body"
            >
              {animationsPaused ? "Play GIF animations" : "Pause GIF animations"}
            </button>
          </div>
        )}
        {status === "loading" && (
          <div className="grid grid-cols-2 gap-2xs" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className="aspect-gif-tile animate-pulse rounded-control bg-surface-2" />
            ))}
          </div>
        )}
        {status === "empty" && (
          <p role="status" className="py-lg text-center text-ui-sm text-muted">
            No GIFs found. Try a simpler phrase.
          </p>
        )}
        {status === "notice" && (
          <div
            role="status"
            className="flex flex-1 flex-col items-center justify-center gap-sm text-center"
          >
            <p className="max-w-form text-ui-sm text-notice">
              GIF search is taking a break. Your message is still here.
            </p>
            {provider.available && (
              <button
                type="button"
                onClick={() => void load()}
                className="min-h-control rounded-control px-sm text-ui-sm text-body underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {status === "ready" && (
          <div className="grid grid-cols-2 gap-2xs" aria-label={resultLabel}>
            {gifs.map((gif) => (
              <button
                key={`${gif.provider}:${gif.providerId}`}
                type="button"
                aria-label={`Choose ${gif.description}`}
                onClick={() => onSelect(gif, query.trim())}
                className="min-h-target-touch overflow-hidden rounded-control text-left hover:outline hover:outline-1 hover:outline-border-strong"
              >
                <GifMedia
                  gif={gif}
                  preview
                  paused={animationsPaused}
                  playRequested={!animationsPaused}
                  fixedAspect
                  className="rounded-none"
                />
              </button>
            ))}
          </div>
        )}
        <div ref={loadMoreRef} className="h-xs shrink-0" aria-hidden="true" />
        {loadingMore && <p className="py-xs text-center text-ui-xs text-muted">Finding more GIFs…</p>}
      </MediaPickerScrollArea>
      <a
        href="https://klipy.com"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 border-t border-divider px-sm py-xs text-right text-ui-xs text-muted hover:text-body"
      >
        Powered by KLIPY
      </a>
    </PickerRoot>
  );
}
