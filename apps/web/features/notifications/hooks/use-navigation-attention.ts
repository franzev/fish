import type {
  AttentionRealtimeService,
  NavigationAttention,
  NavigationAttentionRepository,
} from "@/lib/services";
import { useCallback, useMemo, useState } from "react";
import { useKeyedSubscription } from "@/lib/hooks/use-keyed-subscription";

interface UseNavigationAttentionOptions {
  initialAttention: NavigationAttention[];
  repository: NavigationAttentionRepository;
  realtime: AttentionRealtimeService;
}

function countUnreadConversations(attention: NavigationAttention[]): number {
  return new Set(
    attention.flatMap((item) =>
      (item.surface === "direct" || item.surface === "channel") &&
      item.conversationId &&
      item.unreadCount > 0
        ? [item.conversationId]
        : []
    )
  ).size;
}

export function useNavigationAttention({
  initialAttention,
  repository,
  realtime,
}: UseNavigationAttentionOptions) {
  const [attention, setAttention] = useState(initialAttention);
  const conversationIds = useMemo(
    () => Array.from(new Set(
      attention.flatMap((item) => item.conversationId ? [item.conversationId] : [])
    )).sort(),
    [attention]
  );
  const conversationKey = conversationIds.join("|");
  const refreshAttention = useCallback(async () => {
    const result = await repository.list();
    if (result.ok) setAttention(result.data);
  }, [repository]);
  const subscribe = useCallback(
    (schedule: () => void) => {
      const ids = conversationKey ? conversationKey.split("|") : [];
      return realtime.subscribe(ids, schedule, schedule);
    },
    [conversationKey, realtime]
  );

  useKeyedSubscription({
    key: conversationKey,
    subscribe,
    onInvalidate: refreshAttention,
  });

  return {
    attention,
    unreadConversationCount: countUnreadConversations(attention),
    refreshAttention,
  };
}
