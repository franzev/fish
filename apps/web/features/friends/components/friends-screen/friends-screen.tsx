"use client";

import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getBrowserServices,
  getFriendCommandService,
} from "@/lib/services/runtime/browser";
import type {
  FriendCommandService,
  FriendListItem,
  FriendNotification,
  FriendRealtimeService,
  FriendRepository,
} from "@/lib/services";
import { IconChevronRight, IconUserPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFriendsRefresh } from "../../hooks/use-friends-refresh";

interface FriendsScreenProps {
  userId: string;
  initialFriends: FriendListItem[];
  initialNextCursor: { createdAt: string; id: string } | null;
  initialIncomingRequestCount: number;
  initialAcceptedNotifications: FriendNotification[];
  repository?: FriendRepository;
  commands?: FriendCommandService;
  realtime?: FriendRealtimeService;
}

export function FriendsScreen({
  userId,
  initialFriends,
  initialNextCursor,
  initialIncomingRequestCount,
  initialAcceptedNotifications,
  repository: repositoryOverride,
  commands: commandsOverride,
  realtime: realtimeOverride,
}: FriendsScreenProps) {
  const repository = useMemo(
    () => repositoryOverride ?? getBrowserServices().database.friends,
    [repositoryOverride]
  );
  const commands = useMemo(
    () => getFriendCommandService(commandsOverride),
    [commandsOverride]
  );

  const [friends, setFriends] = useState(initialFriends);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [incomingRequestCount, setIncomingRequestCount] = useState(
    initialIncomingRequestCount
  );
  const [acceptedNotifications] = useState(initialAcceptedNotifications);
  const [loadingMore, setLoadingMore] = useState(false);

  // Deliberately a bounded first-page refresh: wake-up hints and reconnects
  // re-anchor on canonical state instead of patching whatever was loaded.
  async function refresh() {
    const [friendsResult, requestsResult] = await Promise.all([
      repository.listFriends(),
      repository.listIncomingRequests(),
    ]);
    if (friendsResult.ok) {
      setFriends(friendsResult.data.friends);
      setNextCursor(friendsResult.data.nextCursor);
    }
    if (requestsResult.ok) {
      setIncomingRequestCount(requestsResult.data.length);
    }
  }

  useFriendsRefresh(userId, () => void refresh(), realtimeOverride);

  // The accepted notes were already rendered from server data; marking them
  // read once keeps them from reappearing on the next visit.
  const markedRead = useRef(false);
  useEffect(() => {
    if (markedRead.current || acceptedNotifications.length === 0) return;
    markedRead.current = true;
    void commands.markNotificationsRead(
      acceptedNotifications.map((notification) => notification.id)
    );
  }, [acceptedNotifications, commands]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await repository.listFriends(nextCursor);
    if (result.ok) {
      setFriends((current) => [...current, ...result.data.friends]);
      setNextCursor(result.data.nextCursor);
    }
    setLoadingMore(false);
  }

  return (
    <div className="flex flex-col gap-lg">
      <div aria-live="polite" className="flex flex-col gap-xs">
        {incomingRequestCount > 0 && (
          <Link
            href="/friends/requests"
            className="flex min-h-control items-center justify-between rounded-control border border-border-strong bg-surface px-md text-ui text-body transition-colors hover:bg-surface-2"
          >
            <span>
              {incomingRequestCount === 1
                ? "A friend request is waiting"
                : "Friend requests are waiting"}
            </span>
            <span className="text-ui-sm text-muted">Review</span>
          </Link>
        )}
        {acceptedNotifications.map((notification) => (
          <p key={notification.id} className="text-ui-sm text-muted">
            {notification.actor.displayName} accepted your friend request.
          </p>
        ))}
      </div>

      {friends.length === 0 ? (
        <p className="text-copy text-body">
          No friends here yet. Add one whenever you&apos;re ready.
        </p>
      ) : (
        <ul className="flex flex-col gap-xs">
          {friends.map((item) => (
            <li key={item.friendshipId}>
              <Link
                href={`/friends/${item.friend.id}`}
                className="flex min-h-control items-center justify-between rounded-control border border-border bg-surface px-md transition-colors hover:bg-surface-2"
              >
                <span className="flex min-w-0 flex-col py-xs">
                  <span className="truncate text-copy text-foreground">
                    {item.friend.displayName}
                  </span>
                  <span className="truncate text-ui-sm text-muted">
                    @{item.friend.username}
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
          Show more friends
        </Button>
      )}

      <Link
        href="/friends/add"
        className={cn(buttonVariants({ variant: "primary" }), "gap-xs")}
      >
        <IconUserPlus size={20} stroke={1.75} aria-hidden="true" />
        Add a friend
      </Link>
    </div>
  );
}
