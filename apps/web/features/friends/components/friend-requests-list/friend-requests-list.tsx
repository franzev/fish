"use client";

import { getBrowserServices } from "@/lib/services/runtime/browser";
import type {
  FriendRealtimeService,
  FriendRepository,
  IncomingFriendRequest,
} from "@/lib/services";
import { IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFriendsRefresh } from "../../hooks/use-friends-refresh";

interface FriendRequestsListProps {
  userId: string;
  initialRequests: IncomingFriendRequest[];
  initialNextCursor: { createdAt: string; id: string } | null;
  repository?: FriendRepository;
  realtime?: FriendRealtimeService;
}

export function FriendRequestsList({
  userId,
  initialRequests,
  initialNextCursor,
  repository: repositoryOverride,
  realtime: realtimeOverride,
}: FriendRequestsListProps) {
  const repository = useMemo(
    () => repositoryOverride ?? getBrowserServices().database.friends,
    [repositoryOverride]
  );
  const [requests, setRequests] = useState(initialRequests);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  async function refresh() {
    const result = await repository.listIncomingRequests();
    if (result.ok) {
      setRequests(result.data.requests);
      setNextCursor(result.data.nextCursor);
    }
  }

  useFriendsRefresh(userId, () => void refresh(), realtimeOverride);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await repository.listIncomingRequests(nextCursor);
    if (result.ok) {
      setRequests((current) => [...current, ...result.data.requests]);
      setNextCursor(result.data.nextCursor);
    }
    setLoadingMore(false);
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-md">
      {requests.length === 0 ? (
        <p className="text-copy text-body">
          No requests right now. New ones will appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-xs">
          {requests.map((request) => (
            <li key={request.requestId}>
              <Link
                href={`/friends/requests/${request.requestId}`}
                className="flex min-h-control items-center justify-between rounded-control border border-border bg-surface px-md transition-colors hover:bg-surface-2"
              >
                <span className="flex min-w-0 flex-col py-xs">
                  <span className="truncate text-copy text-foreground">
                    {request.sender.displayName}
                  </span>
                  <span className="truncate text-ui-sm text-muted">
                    @{request.sender.username}
                  </span>
                </span>
                <IconChevronRight
                  size={20}
                  stroke={1.75}
                  aria-hidden="true"
                  className="shrink-0 text-muted"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {nextCursor && (
        <Button
          type="button"
          variant="ghost"
          loading={loadingMore}
          onClick={() => void loadMore()}
        >
          Show more requests
        </Button>
      )}
    </div>
  );
}
