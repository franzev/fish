import { mergeNotificationItems } from "./selectors";
import type {
  NotificationChange,
  NotificationEvent,
  NotificationItem,
  NotificationOperationKind,
  NotificationState,
  PendingNotificationOperation,
} from "./types";

const emptySummary = {
  unreadCount: 0,
  unseenCount: 0,
  latestChangeSeq: 0,
};

export function createInitialNotificationState(): NotificationState {
  return {
    items: [],
    filter: "all",
    summary: emptySummary,
    pagination: { nextCursor: null, isLoading: false, hasError: false },
    realtimeStatus: "idle",
    pendingOperations: {},
    needsRefresh: false,
  };
}

function affectedByOperation(
  item: NotificationItem,
  kind: NotificationOperationKind,
  itemIds: Set<string>,
  throughChangeSeq: number
) {
  if (item.changeSeq > throughChangeSeq) return false;
  if (kind === "markAllRead" || kind === "archiveRead") return true;
  return itemIds.has(item.id);
}

function applyOptimisticOperation(
  state: NotificationState,
  event: Extract<NotificationEvent, { type: "optimisticOperation" }>
): NotificationState {
  if (state.pendingOperations[event.operationId]) return state;

  const itemIds = new Set(event.itemIds ?? []);
  const previousItems: NotificationItem[] = [];
  let unreadDelta = 0;
  let unseenDelta = 0;

  const items = state.items.map((item) => {
    if (
      !affectedByOperation(
        item,
        event.operationKind,
        itemIds,
        event.throughChangeSeq
      )
    ) {
      return item;
    }

    if (
      event.operationKind === "archiveRead" &&
      (item.readAt === null || item.category === "actionRequired")
    ) {
      return item;
    }

    previousItems.push(item);
    if (
      (event.operationKind === "read" ||
        event.operationKind === "markAllRead") &&
      item.readAt === null
    ) {
      unreadDelta -= 1;
    }
    if (
      (event.operationKind === "seen" ||
        event.operationKind === "read" ||
        event.operationKind === "markAllRead") &&
      item.seenAt === null
    ) {
      unseenDelta -= 1;
    }

    if (event.operationKind === "seen") {
      return { ...item, seenAt: item.seenAt ?? event.occurredAt };
    }
    if (
      event.operationKind === "read" ||
      event.operationKind === "markAllRead"
    ) {
      return {
        ...item,
        seenAt: item.seenAt ?? event.occurredAt,
        readAt: item.readAt ?? event.occurredAt,
      };
    }
    if (event.operationKind === "archiveRead") {
      return null;
    }
    return item;
  }).filter((item): item is NotificationItem => item !== null);

  const operation: PendingNotificationOperation = {
    id: event.operationId,
    kind: event.operationKind,
    itemIds: event.itemIds ?? [],
    throughChangeSeq: event.throughChangeSeq,
    occurredAt: event.occurredAt,
    previousItems,
    previousSummary: state.summary,
    unreadDelta:
      event.operationKind === "markAllRead"
        ? state.items.filter(
            (item) => item.changeSeq > event.throughChangeSeq && item.readAt === null
          ).length - state.summary.unreadCount
        : unreadDelta,
    unseenDelta:
      event.operationKind === "markAllRead"
        ? state.items.filter(
            (item) => item.changeSeq > event.throughChangeSeq && item.seenAt === null
          ).length - state.summary.unseenCount
        : unseenDelta,
  };

  return {
    ...state,
    items,
    summary: {
      ...state.summary,
      unreadCount:
        event.operationKind === "markAllRead"
          ? state.summary.unreadCount + operation.unreadDelta
          : Math.max(0, state.summary.unreadCount + unreadDelta),
      unseenCount:
        event.operationKind === "markAllRead"
          ? state.summary.unseenCount + operation.unseenDelta
          : Math.max(0, state.summary.unseenCount + unseenDelta),
    },
    pendingOperations: {
      ...state.pendingOperations,
      [operation.id]: operation,
    },
  };
}

function applyChanges(
  state: NotificationState,
  changes: NotificationChange[]
): NotificationState {
  const byId = new Map(changes.map((change) => [change.id, change]));
  let unknownChange = false;
  let unreadDelta = 0;
  let unseenDelta = 0;
  const items = state.items.flatMap((item) => {
    const change = byId.get(item.id);
    if (!change || change.changeSeq < item.changeSeq) return [item];
    byId.delete(item.id);
    const wasUnread = item.readAt === null;
    const wasUnseen = item.seenAt === null;
    const isUnread = change.archivedAt === null && change.readAt === null;
    const isUnseen = change.archivedAt === null && change.seenAt === null;
    unreadDelta += Number(isUnread) - Number(wasUnread);
    unseenDelta += Number(isUnseen) - Number(wasUnseen);
    if (change.archivedAt !== null) return [];
    return [{
      ...item,
      seenAt: change.seenAt,
      readAt: change.readAt,
      changeSeq: change.changeSeq,
    }];
  });
  if (byId.size > 0) unknownChange = true;

  const latestChangeSeq = changes.reduce(
    (latest, change) => Math.max(latest, change.changeSeq),
    state.summary.latestChangeSeq
  );
  return {
    ...state,
    items,
    summary: {
      unreadCount: Math.max(0, state.summary.unreadCount + unreadDelta),
      unseenCount: Math.max(0, state.summary.unseenCount + unseenDelta),
      latestChangeSeq,
    },
    needsRefresh: state.needsRefresh || unknownChange,
  };
}

export function reduceNotificationState(
  state: NotificationState,
  event: NotificationEvent
): NotificationState {
  switch (event.type) {
    case "hydrate": {
      const pendingOperations = Object.values(state.pendingOperations);
      let hydrated: NotificationState = {
        ...state,
        items: mergeNotificationItems([], event.page.items),
        filter: event.filter,
        summary: event.summary,
        pagination: {
          nextCursor: event.page.nextCursor,
          isLoading: false,
          hasError: false,
        },
        pendingOperations: {},
        needsRefresh: false,
      };
      for (const operation of pendingOperations) {
        hydrated = applyOptimisticOperation(hydrated, {
          type: "optimisticOperation",
          operationId: operation.id,
          operationKind: operation.kind,
          itemIds: operation.itemIds,
          throughChangeSeq: operation.throughChangeSeq,
          occurredAt: operation.occurredAt,
        });
      }
      return hydrated;
    }
    case "setFilter":
      if (state.filter === event.filter) return state;
      return {
        ...state,
        filter: event.filter,
        items: [],
        pagination: { nextCursor: null, isLoading: false, hasError: false },
        needsRefresh: true,
      };
    case "olderPageRequested":
      if (state.pagination.isLoading || !state.pagination.nextCursor) return state;
      return {
        ...state,
        pagination: { ...state.pagination, isLoading: true, hasError: false },
      };
    case "olderPageLoaded":
      return {
        ...state,
        items: mergeNotificationItems(state.items, event.page.items),
        pagination: {
          nextCursor: event.page.nextCursor,
          isLoading: false,
          hasError: false,
        },
      };
    case "olderPageFailed":
      if (!state.pagination.isLoading) return state;
      return {
        ...state,
        pagination: { ...state.pagination, isLoading: false, hasError: true },
      };
    case "authoritativeItemsMerged":
      return {
        ...state,
        items: mergeNotificationItems(state.items, event.items),
        needsRefresh: false,
      };
    case "changesApplied":
      return applyChanges(state, event.changes);
    case "optimisticOperation":
      return applyOptimisticOperation(state, event);
    case "operationConfirmed": {
      if (!state.pendingOperations[event.operationId]) return state;
      const pendingOperations = { ...state.pendingOperations };
      delete pendingOperations[event.operationId];
      return { ...state, pendingOperations };
    }
    case "operationFailed": {
      const operation = state.pendingOperations[event.operationId];
      if (!operation) return state;
      const pendingOperations = { ...state.pendingOperations };
      delete pendingOperations[event.operationId];
      const restorable = operation.previousItems.filter((previous) => {
        const current = state.items.find((item) => item.id === previous.id);
        return !current || current.changeSeq <= operation.throughChangeSeq;
      });
      return {
        ...state,
        items: mergeNotificationItems(state.items, restorable),
        summary: {
          ...state.summary,
          unreadCount: Math.max(0, state.summary.unreadCount - operation.unreadDelta),
          unseenCount: Math.max(0, state.summary.unseenCount - operation.unseenDelta),
        },
        pendingOperations,
        needsRefresh: true,
      };
    }
    case "summaryRefreshed":
      return { ...state, summary: event.summary };
    case "refreshRequired":
      return { ...state, needsRefresh: true };
    case "refreshSatisfied":
      return { ...state, needsRefresh: false };
    case "realtimeStatusChanged":
      return { ...state, realtimeStatus: event.status };
    case "reset":
      return createInitialNotificationState();
  }
}
