import { CommunityMessageRowLayout } from "./community-message-row-layout";

const contentAtomClassName =
  "h-sm w-full max-w-message rounded-control bg-surface-2 animate-skeleton-pulse";

/** Two deterministic community rows matching an author row and its continuation. */
export function MessageRowsSkeleton() {
  return (
    <div aria-hidden="true" data-testid="load-older-skeleton">
      <CommunityMessageRowLayout
        avatarSlot={
          <div
            data-testid="skeleton-avatar"
            className="size-8 shrink-0 rounded-pill bg-surface-2 animate-skeleton-pulse"
          />
        }
        startsGroup
        hasPrecedingRow
        interactive={false}
        data-testid="skeleton-row-author"
      >
        <div className="mb-2xs flex items-baseline gap-xs text-muted">
          <span
            data-testid="skeleton-author"
            className="h-sm w-xl rounded-pill bg-surface-2 animate-skeleton-pulse"
          />
          <span
            data-testid="skeleton-timestamp"
            className="h-xs w-lg rounded-pill bg-surface-2 animate-skeleton-pulse"
          />
        </div>
        <div className="flex w-full text-ui-sm">
          <span data-testid="skeleton-content" className={contentAtomClassName} />
        </div>
      </CommunityMessageRowLayout>

      <CommunityMessageRowLayout
        avatarSlot={
          <div
            aria-hidden="true"
            data-testid="skeleton-avatar-spacer"
            className="size-8 shrink-0"
          />
        }
        startsGroup={false}
        hasPrecedingRow
        interactive={false}
        data-testid="skeleton-row-continuation"
      >
        <div className="flex w-full text-ui-sm">
          <span data-testid="skeleton-content" className={contentAtomClassName} />
        </div>
      </CommunityMessageRowLayout>
    </div>
  );
}
