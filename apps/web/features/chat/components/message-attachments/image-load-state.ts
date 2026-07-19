export type ImageLoadState = "loading" | "loaded" | "failed";

export function deriveImageLoadState(input: {
  refreshing: boolean;
  url?: string;
  loadedUrl?: string;
  failedUrl?: string;
  urlRefreshFailed?: boolean;
}): ImageLoadState {
  if (input.refreshing) return "loading";
  if (!input.url) return input.urlRefreshFailed ? "failed" : "loading";
  if (input.failedUrl === input.url) return "failed";
  return input.loadedUrl === input.url ? "loaded" : "loading";
}
