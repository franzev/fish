import type {
  MessagePopoverActionState,
  MessagePopoverPreview,
} from "@/features/chat/contracts";
import { useCallback, useRef, useState } from "react";
import { useLatestRequest } from "./use-latest-request";

interface PreviewLoadState {
  loaded: boolean;
  loading: boolean;
  notice: string | null;
  previews: MessagePopoverPreview[];
}

export function useMessagePreviews(
  loadPreviewAction?: (input: unknown) => Promise<MessagePopoverActionState>
) {
  const [loadState, setLoadState] = useState<PreviewLoadState>({
    loaded: false,
    loading: false,
    notice: null,
    previews: [],
  });
  const successfulLoadRef = useRef(false);
  const inFlightRequestRef = useRef<Promise<void> | null>(null);
  const { begin, isLatest } = useLatestRequest("messages-popover");

  const loadPreview = useCallback((force = false): Promise<void> => {
    if (!loadPreviewAction || (successfulLoadRef.current && !force)) {
      return Promise.resolve();
    }
    if (inFlightRequestRef.current) return inFlightRequestRef.current;

    const requestToken = begin();
    setLoadState((current) => ({
      ...current,
      loading: true,
      notice: current.loaded ? current.notice : null,
    }));

    const request = (async () => {
      try {
        const result = await loadPreviewAction({});
        if (!isLatest(requestToken)) return;
        if (result.status === "sent") successfulLoadRef.current = true;
        setLoadState((current) => ({
          loaded: true,
          loading: false,
          notice: result.status === "notice"
            ? current.previews.length > 0
              ? null
              : result.notice ?? "Messages are still catching up."
            : null,
          previews: result.status === "sent"
            ? result.previews ?? []
            : current.previews,
        }));
      } catch {
        if (!isLatest(requestToken)) return;
        setLoadState((current) => ({
          ...current,
          loaded: true,
          loading: false,
          notice: current.previews.length > 0
            ? null
            : "Messages are still catching up.",
        }));
      } finally {
        if (isLatest(requestToken)) inFlightRequestRef.current = null;
      }
    })();

    inFlightRequestRef.current = request;
    return request;
  }, [begin, isLatest, loadPreviewAction]);

  return {
    loadState,
    loadPreview,
    visiblePreviews(filter: "all" | "unread") {
      return filter === "unread"
        ? loadState.previews.filter((preview) => preview.unreadCount > 0)
        : loadState.previews;
    },
  };
}
