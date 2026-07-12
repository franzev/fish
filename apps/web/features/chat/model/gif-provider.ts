import "client-only";

import type { ClientChatGif } from "@/lib/services";

const klipyBaseUrl = "https://api.klipy.com/v2";
const defaultPageSize = 12;
let inMemoryCustomerId: string | null = null;

export interface GifSearchPage {
  gifs: ClientChatGif[];
  next: string | null;
}

export interface GifBrowseInput {
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

export interface GifSearchInput extends GifBrowseInput {
  query: string;
}

export interface GifShareInput {
  gif: ClientChatGif;
  query?: string;
}

export interface GifProvider {
  readonly name: string;
  readonly available: boolean;
  search(input: GifSearchInput): Promise<GifSearchPage>;
  trending(input?: GifBrowseInput): Promise<GifSearchPage>;
  registerShare(input: GifShareInput): Promise<void>;
}

interface KlipyMediaFormat {
  url?: unknown;
  dims?: unknown;
}

interface KlipyResult {
  id?: unknown;
  title?: unknown;
  content_description?: unknown;
  itemurl?: unknown;
  url?: unknown;
  media_formats?: Record<string, KlipyMediaFormat>;
}

function publicApiKey(): string {
  return process.env.NEXT_PUBLIC_KLIPY_API_KEY?.trim() ?? "";
}

function clientKey(): string {
  return process.env.NEXT_PUBLIC_KLIPY_CLIENT_KEY?.trim() || "fish_chat";
}

function locale(): string {
  return typeof navigator === "undefined"
    ? "en_US"
    : (navigator.language || "en-US").replace("-", "_");
}

function customerId(): string {
  if (typeof window === "undefined") return "fish_web";
  const storageKey = "fish-gif-customer-id";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
  } catch {
    // Privacy modes and embedded browsers may expose localStorage but deny
    // access. A session-only pseudonym is sufficient for share relevance.
  }
  if (inMemoryCustomerId) return inMemoryCustomerId;
  const created = globalThis.crypto?.randomUUID?.() ?? `gif-${Date.now()}`;
  inMemoryCustomerId = created;
  try {
    window.localStorage.setItem(storageKey, created);
  } catch {
    // Keep the in-memory value above.
  }
  return created;
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function mediaUrl(result: KlipyResult, key: string): string | null {
  return httpsUrl(result.media_formats?.[key]?.url);
}

function dimensions(result: KlipyResult): [number, number] | null {
  for (const key of ["mp4", "tinymp4", "preview"]) {
    const dims = result.media_formats?.[key]?.dims;
    if (
      Array.isArray(dims)
      && dims.length === 2
      && Number.isInteger(dims[0])
      && Number.isInteger(dims[1])
      && Number(dims[0]) > 0
      && Number(dims[1]) > 0
    ) {
      return [Math.min(Number(dims[0]), 4096), Math.min(Number(dims[1]), 4096)];
    }
  }
  return null;
}

function isKlipyMediaUrl(value: string): boolean {
  return /^static\d*\.klipy\.com$/.test(new URL(value).hostname.toLowerCase());
}

export function mapKlipyResult(result: KlipyResult): ClientChatGif | null {
  const providerId = cleanText(result.id, "", 200);
  const posterUrl = mediaUrl(result, "preview");
  const previewUrl = mediaUrl(result, "tinymp4");
  const media = mediaUrl(result, "mp4");
  const dims = dimensions(result);
  if (
    !providerId
    || !posterUrl
    || !previewUrl
    || !media
    || !dims
    || ![posterUrl, previewUrl, media].every(isKlipyMediaUrl)
  ) return null;

  const returnedSourceUrl = httpsUrl(result.itemurl) ?? httpsUrl(result.url);
  const sourceUrl = returnedSourceUrl
    && (new URL(returnedSourceUrl).hostname === "klipy.com"
      || new URL(returnedSourceUrl).hostname.endsWith(".klipy.com"))
    ? returnedSourceUrl
    : `https://klipy.com/gifs/${encodeURIComponent(providerId)}`;
  const title = cleanText(result.title, "Animated GIF", 300);
  const description = cleanText(result.content_description, title, 500);

  return {
    provider: "klipy",
    providerId,
    title,
    description,
    sourceUrl,
    posterUrl,
    previewUrl,
    mediaUrl: media,
    width: dims[0],
    height: dims[1],
  };
}

export class KlipyGifProvider implements GifProvider {
  readonly name = "KLIPY";
  readonly available: boolean;

  constructor(private readonly apiKey = publicApiKey()) {
    this.available = Boolean(apiKey);
  }

  search(input: GifSearchInput): Promise<GifSearchPage> {
    const query = input.query.trim().slice(0, 50);
    if (!query) return Promise.resolve({ gifs: [], next: null });
    return this.request("search", { ...input, query });
  }

  trending(input: GifBrowseInput = {}): Promise<GifSearchPage> {
    return this.request("featured", input);
  }

  async registerShare({ gif, query }: GifShareInput): Promise<void> {
    if (!this.available || gif.provider !== "klipy") return;
    const url = new URL(`${klipyBaseUrl}/registershare`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("client_key", clientKey());
    url.searchParams.set("id", gif.providerId);
    url.searchParams.set("customer_id", customerId());
    url.searchParams.set("locale", locale());
    if (query?.trim()) url.searchParams.set("q", query.trim().slice(0, 50));
    await fetch(url, { method: "GET", keepalive: true }).then(() => undefined);
  }

  private async request(
    endpoint: "search" | "featured",
    input: GifBrowseInput & { query?: string }
  ): Promise<GifSearchPage> {
    if (!this.available) throw new Error("GIF provider is not configured");
    const url = new URL(`${klipyBaseUrl}/${endpoint}`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("client_key", clientKey());
    url.searchParams.set("customer_id", customerId());
    url.searchParams.set("locale", locale());
    url.searchParams.set("contentfilter", "high");
    url.searchParams.set("media_filter", "preview,tinymp4,mp4");
    url.searchParams.set("limit", String(Math.min(input.limit ?? defaultPageSize, 24)));
    if (input.query) url.searchParams.set("q", input.query);
    if (input.cursor) url.searchParams.set("pos", input.cursor);

    const response = await fetch(url, { signal: input.signal });
    if (!response.ok) throw new Error(`GIF provider returned ${response.status}`);
    const payload = await response.json() as { results?: unknown; next?: unknown };
    const results = Array.isArray(payload.results) ? payload.results as KlipyResult[] : [];
    return {
      gifs: results.flatMap((result) => {
        const gif = mapKlipyResult(result);
        return gif ? [gif] : [];
      }),
      next: typeof payload.next === "string" && payload.next ? payload.next : null,
    };
  }
}

export const gifProvider: GifProvider = new KlipyGifProvider();
