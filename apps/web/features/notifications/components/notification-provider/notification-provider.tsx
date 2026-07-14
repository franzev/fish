"use client";

import {
  createInitialNotificationState,
  reduceNotificationState,
  selectUnreadNotificationIds,
  type NotificationFilter,
  type NotificationItem,
  type NotificationPage,
  type NotificationState,
  type NotificationSummary,
} from "@fish/core/notification-state";
import {
  getBrowserServices,
  getAttentionRealtimeService,
  getNotificationCommandService,
  getNotificationRealtimeService,
} from "@/lib/services/runtime/browser";
import type {
  NotificationCommandService,
  NotificationRealtimeService,
  NotificationRepository,
  NavigationAttention,
  AttentionRealtimeService,
  NavigationAttentionRepository,
} from "@/lib/services";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

interface NotificationContextValue {
  state: NotificationState;
  notice: string | null;
  isRefreshing: boolean;
  archiveBatchId: string | null;
  attention: NavigationAttention[];
  refresh(): Promise<void>;
  setFilter(filter: NotificationFilter): Promise<void>;
  loadOlder(): Promise<void>;
  markLoadedSeen(): Promise<void>;
  markRead(item: NotificationItem): Promise<void>;
  markAllRead(): Promise<void>;
  archiveRead(): Promise<void>;
  undoArchive(): Promise<void>;
  acknowledgeModeration(item: NotificationItem): Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const browserTabBaseTitle = "FISH";
const browserTabCountLimit = 9;

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

function formatBrowserTabTitle(unreadConversationCount: number): string {
  if (unreadConversationCount === 0) return browserTabBaseTitle;
  const count = unreadConversationCount > browserTabCountLimit
    ? `${browserTabCountLimit}+`
    : unreadConversationCount;
  return `(${count}) ${browserTabBaseTitle}`;
}

interface NotificationProviderProps {
  userId: string;
  initialPage: NotificationPage;
  initialSummary: NotificationSummary;
  initialAttention: NavigationAttention[];
  children: React.ReactNode;
  repository?: NotificationRepository;
  commands?: NotificationCommandService;
  realtime?: NotificationRealtimeService;
  attentionRealtime?: AttentionRealtimeService;
  attentionRepository?: NavigationAttentionRepository;
}

function operationId() {
  return globalThis.crypto?.randomUUID?.() ?? `notification-${Date.now()}-${Math.random()}`;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function NotificationProvider({
  userId,
  initialPage,
  initialSummary,
  initialAttention,
  children,
  repository: repositoryOverride,
  commands: commandsOverride,
  realtime: realtimeOverride,
  attentionRealtime: attentionRealtimeOverride,
  attentionRepository: attentionRepositoryOverride,
}: NotificationProviderProps) {
  const repository = useMemo(
    () => repositoryOverride ?? getBrowserServices().database.notifications,
    [repositoryOverride]
  );
  const commands = useMemo(
    () => getNotificationCommandService(commandsOverride),
    [commandsOverride]
  );
  const realtime = useMemo(
    () => getNotificationRealtimeService(realtimeOverride),
    [realtimeOverride]
  );
  const attentionRepository = useMemo(
    () => attentionRepositoryOverride ?? getBrowserServices().database.attention,
    [attentionRepositoryOverride]
  );
  const attentionRealtime = useMemo(
    () => getAttentionRealtimeService(attentionRealtimeOverride),
    [attentionRealtimeOverride]
  );
  const [state, dispatch] = useReducer(
    reduceNotificationState,
    undefined,
    () => reduceNotificationState(createInitialNotificationState(), {
      type: "hydrate",
      page: initialPage,
      summary: initialSummary,
      filter: "all",
    })
  );
  const stateRef = useRef(state);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [archiveBatchId, setArchiveBatchId] = useState<string | null>(null);
  const [attention, setAttention] = useState(initialAttention);
  const unreadConversationCount = countUnreadConversations(attention);
  const attentionConversationKey = attention
    .flatMap((item) => item.conversationId ? [item.conversationId] : [])
    .sort()
    .join("|");

  useEffect(() => {
    const initialTitle = document.title || browserTabBaseTitle;
    return () => {
      document.title = initialTitle;
    };
  }, []);

  useEffect(() => {
    document.title = formatBrowserTabTitle(unreadConversationCount);
  }, [unreadConversationCount]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshForFilter = useCallback(async (filter: NotificationFilter) => {
    setIsRefreshing(true);
    const [page, summary, nextAttention] = await Promise.all([
      repository.listPage({ filter }),
      repository.getSummary(),
      attentionRepository.list(),
    ]);
    setIsRefreshing(false);
    if (!page.ok || !summary.ok) {
      setNotice("Notifications will catch up when the connection settles.");
      return;
    }
    setNotice(null);
    if (nextAttention.ok) setAttention(nextAttention.data);
    dispatch({
      type: "hydrate",
      page: page.data,
      summary: summary.data,
      filter,
    });
  }, [attentionRepository, repository]);

  const refreshAttention = useCallback(async () => {
    const result = await attentionRepository.list();
    if (result.ok) setAttention(result.data);
  }, [attentionRepository]);

  const refresh = useCallback(
    () => refreshForFilter(stateRef.current.filter),
    [refreshForFilter]
  );

  const recover = useCallback(async () => {
    const afterChangeSeq = stateRef.current.summary.latestChangeSeq;
    const changes = await repository.listChanges(afterChangeSeq);
    if (changes.ok && changes.data.length > 0) {
      dispatch({ type: "changesApplied", changes: changes.data });
    }
    await refreshForFilter(stateRef.current.filter);
  }, [refreshForFilter, repository]);

  const scheduleRecovery = useCallback(() => {
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = setTimeout(() => {
      recoveryTimerRef.current = null;
      void recover();
    }, 150);
  }, [recover]);

  useEffect(() => {
    dispatch({ type: "realtimeStatusChanged", status: "connecting" });
    const unsubscribe = realtime.subscribe(
      userId,
      (hint) => {
        if (hint.changeSeq > stateRef.current.summary.latestChangeSeq) {
          scheduleRecovery();
        }
      },
      scheduleRecovery,
      (status) => dispatch({ type: "realtimeStatusChanged", status })
    );
    const onOnline = () => scheduleRecovery();
    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleRecovery();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, [realtime, scheduleRecovery, userId]);

  useEffect(() => {
    const conversationIds = attentionConversationKey
      ? attentionConversationKey.split("|")
      : [];
    const schedule = () => {
      if (attentionTimerRef.current) clearTimeout(attentionTimerRef.current);
      attentionTimerRef.current = setTimeout(() => {
        attentionTimerRef.current = null;
        void refreshAttention();
      }, 150);
    };
    const unsubscribe = attentionRealtime.subscribe(
      conversationIds,
      schedule,
      schedule
    );
    return () => {
      unsubscribe();
      if (attentionTimerRef.current) clearTimeout(attentionTimerRef.current);
    };
  }, [attentionConversationKey, attentionRealtime, refreshAttention]);

  const runItemOperation = useCallback(async (
    kind: "seen" | "read",
    itemIds: string[]
  ) => {
    const throughChangeSeq = stateRef.current.summary.latestChangeSeq;
    for (const notificationIds of chunks(itemIds, 100)) {
      const id = operationId();
      dispatch({
        type: "optimisticOperation",
        operationId: id,
        operationKind: kind,
        itemIds: notificationIds,
        throughChangeSeq,
        occurredAt: new Date().toISOString(),
      });
      const result = await commands.execute({
        action: kind === "seen" ? "mark-seen" : "mark-read",
        notificationIds,
        throughChangeSeq,
      });
      dispatch({
        type: result.ok ? "operationConfirmed" : "operationFailed",
        operationId: id,
      });
      if (!result.ok) setNotice(result.notice);
    }
  }, [commands]);

  const markLoadedSeen = useCallback(async () => {
    const ids = stateRef.current.items
      .filter((item) => item.seenAt === null)
      .map((item) => item.id);
    if (ids.length > 0) await runItemOperation("seen", ids);
  }, [runItemOperation]);

  const markRead = useCallback(async (item: NotificationItem) => {
    if (item.readAt === null) await runItemOperation("read", [item.id]);
  }, [runItemOperation]);

  const markAllRead = useCallback(async () => {
    const current = stateRef.current;
    if (current.summary.unreadCount === 0) return;
    const id = operationId();
    dispatch({
      type: "optimisticOperation",
      operationId: id,
      operationKind: "markAllRead",
      itemIds: selectUnreadNotificationIds(current),
      throughChangeSeq: current.summary.latestChangeSeq,
      occurredAt: new Date().toISOString(),
    });
    const result = await commands.execute({
      action: "mark-all-read",
      throughChangeSeq: current.summary.latestChangeSeq,
    });
    dispatch({ type: result.ok ? "operationConfirmed" : "operationFailed", operationId: id });
    if (!result.ok) setNotice(result.notice);
  }, [commands]);

  const archiveRead = useCallback(async () => {
    const current = stateRef.current;
    const readIds = current.items.filter((item) => item.readAt !== null).map((item) => item.id);
    const id = operationId();
    dispatch({
      type: "optimisticOperation",
      operationId: id,
      operationKind: "archiveRead",
      itemIds: readIds,
      throughChangeSeq: current.summary.latestChangeSeq,
      occurredAt: new Date().toISOString(),
    });
    const result = await commands.execute({
      action: "archive-read",
      throughChangeSeq: current.summary.latestChangeSeq,
    });
    dispatch({ type: result.ok ? "operationConfirmed" : "operationFailed", operationId: id });
    if (result.ok) {
      setArchiveBatchId(result.archiveBatchId ?? null);
      setNotice(result.updated > 0 ? "Read notifications cleared." : null);
    } else {
      setNotice(result.notice);
    }
  }, [commands]);

  const undoArchive = useCallback(async () => {
    if (!archiveBatchId) return;
    const result = await commands.execute({ action: "restore", archiveBatchId });
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }
    setArchiveBatchId(null);
    setNotice(null);
    await refreshForFilter(stateRef.current.filter);
  }, [archiveBatchId, commands, refreshForFilter]);

  const acknowledgeModeration = useCallback(async (item: NotificationItem) => {
    if (!item.moderationActionId) return;
    const result = await commands.execute({
      action: "acknowledge-moderation",
      moderationActionId: item.moderationActionId,
    });
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }
    setNotice(null);
    await refreshForFilter(stateRef.current.filter);
  }, [commands, refreshForFilter]);

  const setFilter = useCallback(async (filter: NotificationFilter) => {
    if (stateRef.current.filter === filter) return;
    dispatch({ type: "setFilter", filter });
    await refreshForFilter(filter);
  }, [refreshForFilter]);

  const loadOlder = useCallback(async () => {
    const current = stateRef.current;
    if (!current.pagination.nextCursor || current.pagination.isLoading) return;
    dispatch({ type: "olderPageRequested" });
    const result = await repository.listPage({
      filter: current.filter,
      cursor: current.pagination.nextCursor,
    });
    dispatch(result.ok
      ? { type: "olderPageLoaded", page: result.data }
      : { type: "olderPageFailed" });
    if (!result.ok) setNotice("Older notifications are still catching up.");
  }, [repository]);

  const value = useMemo<NotificationContextValue>(() => ({
    state,
    attention,
    notice,
    isRefreshing,
    archiveBatchId,
    refresh,
    setFilter,
    loadOlder,
    markLoadedSeen,
    markRead,
    markAllRead,
    archiveRead,
    undoArchive,
    acknowledgeModeration,
  }), [
    archiveBatchId,
    attention,
    archiveRead,
    isRefreshing,
    loadOlder,
    markAllRead,
    markLoadedSeen,
    markRead,
    notice,
    refresh,
    setFilter,
    state,
    undoArchive,
    acknowledgeModeration,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationProvider");
  return value;
}

export function useOptionalNotifications(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
