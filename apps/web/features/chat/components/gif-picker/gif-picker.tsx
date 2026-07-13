"use client";

import { gifProvider, type GifProvider } from "@/features/chat/model/gif-provider";
import type { ClientChatGif } from "@/lib/services";
import { Popover } from "@base-ui/react/popover";
import { IconGif, IconSearch } from "@tabler/icons-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GifMedia } from "../gif-media";

type PickerStatus = "loading" | "ready" | "empty" | "notice";

interface GifPickerProps {
  onSelect: (gif: ClientChatGif, query: string) => void;
  provider?: GifProvider;
}

export function GifPicker({ onSelect, provider = gifProvider }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<ClientChatGif[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<PickerStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [animationsPaused, setAnimationsPaused] = useState(() =>
    typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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

  return (
    <div
      role="dialog"
      aria-label="Choose a GIF"
      className="flex h-gif-panel-h w-gif-panel flex-col overflow-hidden rounded-card border border-border bg-surface shadow-popover"
    >
      <div className="relative shrink-0 p-xs">
        <label htmlFor="gif-search" className="sr-only">Search GIFs</label>
        <span className="pointer-events-none absolute inset-y-0 left-page flex items-center text-muted">
          <IconSearch size={16} stroke={1.75} aria-hidden="true" />
        </span>
        <input
          id="gif-search"
          type="search"
          placeholder="Search KLIPY"
          value={query}
          maxLength={50}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-control w-full rounded-pill border border-transparent bg-surface-2 pl-xl pr-sm text-ui-sm text-foreground placeholder:text-muted focus-visible:border-border-strong focus-visible:shadow-none focus-visible:outline-none"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-xs pb-xs">
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
              onClick={() => setAnimationsPaused((current) => !current)}
              className="min-h-target-touch rounded-control px-xs text-ui-xs text-muted hover:bg-surface-2 hover:text-body"
            >
              {animationsPaused ? "Play GIF animations" : "Pause GIF animations"}
            </button>
          </div>
        )}
        {status === "loading" && (
          <div className="grid grid-cols-2 gap-2xs" aria-label="Loading GIFs">
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
                className="min-h-target-touch overflow-hidden rounded-control text-left hover:outline hover:outline-1 hover:outline-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-outer"
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
      </div>
      <a
        href="https://klipy.com"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 border-t border-border px-sm py-xs text-right text-ui-xs text-muted hover:text-body"
      >
        Powered by KLIPY
      </a>
    </div>
  );
}

interface GifPickerButtonProps {
  onSelect: (gif: ClientChatGif, query: string) => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  provider?: GifProvider;
}

export const GifPickerButton = forwardRef<HTMLButtonElement, GifPickerButtonProps>(
  function GifPickerButton({ onSelect, disabled, className, children, provider }, ref) {
    const [open, setOpen] = useState(false);
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          ref={ref}
          aria-label="Add a GIF"
          disabled={disabled}
          className={className}
        >
          {children ?? <IconGif size={20} stroke={1.75} aria-hidden="true" />}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="top"
            align="end"
            sideOffset={4}
            className="gif-picker-positioner z-20"
          >
            <Popover.Popup initialFocus={false}>
              <GifPicker
                provider={provider}
                onSelect={(gif, query) => {
                  onSelect(gif, query);
                  setOpen(false);
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
