import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MessageRowsSkeleton } from "../../visual";
import type { RefObject } from "react";

export interface OlderMessagesControlProps {
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  hasError: boolean;
  loading: boolean;
  onLoad: () => Promise<unknown>;
}

/** Owns the fixed-height older-page feedback region so pagination state
 * changes never shift the transcript below it. */
export function OlderMessagesControl({
  sentinelRef,
  hasMore,
  hasError,
  loading,
  onLoad,
}: OlderMessagesControlProps) {
  if (!hasMore && !hasError) {
    return null;
  }

  return (
    <>
      {hasMore && (
        <div
          ref={sentinelRef}
          aria-hidden="true"
          data-testid="load-older-sentinel"
          className="h-3xs w-full"
        />
      )}
      <div
        data-testid="load-older-slot"
        className="flex h-pagination-slot flex-col justify-center gap-xs pb-md"
      >
        {loading ? (
          <>
            <MessageRowsSkeleton />
            <span role="status" className="sr-only">
              Loading earlier messages
            </span>
          </>
        ) : hasError ? (
          <div
            className="flex items-center gap-xs"
            data-testid="load-older-error"
          >
            <Alert tone="notice" className="min-w-0 flex-1">
              Couldn&apos;t load earlier messages. Try again.
            </Alert>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void onLoad()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void onLoad()}
            >
              Load earlier messages
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
