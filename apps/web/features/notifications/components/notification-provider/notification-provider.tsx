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
import { useBrowserTabTitle } from "../../hooks/use-browser-tab-title";
import { useNavigationAttention } from "../../hooks/use-navigation-attention";
import {
  markSeenThroughChangeSeq,
  planMarkSeenOutcome,
  unseenNotificationIds,
} from "../../model/mark-seen";
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
  refreshAndMarkLoadedSeen(): Promise<void>;
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

const markSeenSnapshotRetryLimit = 3;

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
  const [notice, setNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [archiveBatchId, setArchiveBatchId] = useState<string | null>(null);
  const {
    attention,
    unreadConversationCount,
    refreshAttention,
  } = useNavigationAttention({
    initialAttention,
    repository: attentionRepository,
    realtime: attentionRealtime,
  });
  useBrowserTabTitle(unreadConversationCount);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshForFilter = useCallback(async (filter: NotificationFilter) => {
    setIsRefreshing(true);
    const [page, summary] = await Promise.all([
      repository.listPage({ filter }),
      repository.getSummary(),
      refreshAttention(),
    ]);
    setIsRefreshing(false);
    if (!page.ok || !summary.ok) {
      setNotice("Notifications will catch up when the connection settles.");
      return;
    }
    setNotice(null);
    dispatch({
      type: "hydrate",
      page: page.data,
      summary: summary.data,
      filter,
    });
  }, [refreshAttention, repository]);

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

  const refreshAndMarkLoadedSeen = useCallback(async () => {
    const filter = stateRef.current.filter;
    setIsRefreshing(true);
    const [page, summary] = await Promise.all([
      repository.listPage({ filter }),
      repository.getSummary(),
      refreshAttention(),
    ]);

    if (!page.ok || !summary.ok) {
      setIsRefreshing(false);
      setNotice("Notifications will catch up when the connection settles.");
      return;
    }

    let nextPage = page.data;
    let nextSummary = summary.data;
    let nextNotice: string | null = null;

    for (let attempt = 0; attempt < markSeenSnapshotRetryLimit; attempt += 1) {
      const unseenIds = unseenNotificationIds(nextPage);
      if (unseenIds.length === 0) break;
      const throughChangeSeq = markSeenThroughChangeSeq(nextPage, nextSummary);
      const result = await commands.execute({
        action: "mark-seen",
        notificationIds: unseenIds,
        throughChangeSeq,
      });
      const [settledPage, settledSummary] = result.ok
        ? await Promise.all([
            repository.listPage({ filter }),
            repository.getSummary(),
          ])
        : [{ ok: false as const }, { ok: false as const }];
      const plan = planMarkSeenOutcome({
        page: nextPage,
        summary: nextSummary,
        commandResult: result,
        attempt,
        settled: {
          page: settledPage.ok ? settledPage.data : null,
          summary: settledSummary.ok ? settledSummary.data : null,
        },
        seenAt: new Date().toISOString(),
      });
      nextPage = plan.nextPage;
      nextSummary = plan.nextSummary;
      nextNotice = plan.notice;
      if (!plan.retry) break;
    }

    dispatch({
      type: "hydrate",
      page: nextPage,
      summary: nextSummary,
      filter,
    });
    setNotice(nextNotice);
    setIsRefreshing(false);
  }, [commands, refreshAttention, repository]);

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
    refreshAndMarkLoadedSeen,
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
    refreshAndMarkLoadedSeen,
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
