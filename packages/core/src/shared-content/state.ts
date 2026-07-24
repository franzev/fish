import {
  SHARED_CONTENT_CACHE_LIMITS,
  type SharedContentCacheHydrationInput,
  type SharedContentCacheHydrationResult,
  type SharedContentDeliveryBatch,
  type SharedContentDeliveryPlanningInput,
  type SharedContentDeliveryPlanningResult,
  type SharedContentPresentationContract,
  type SharedContentRecoveryInput,
  type SharedContentCursor,
  type SharedContentEvent,
  type SharedContentItem,
  type SharedContentPage,
  type SharedContentState,
} from "./types.ts";

export function createSharedContentState(
  identityId: string | null = null,
  conversationId: string | null = null,
  identityGeneration = 1,
): SharedContentState {
  return {
    identityId,
    conversationId,
    identityGeneration,
    items: [],
    pages: [],
    nextCursor: null,
    hasMore: false,
    pendingPageRequest: null,
    categories: [],
    status: "empty",
    deliveryReferences: [],
    temporaryReferences: [],
    error: null,
    deletedSourceMessageIds: [],
  };
}

export function applySharedContentEvents(
  state: SharedContentState,
  events: SharedContentEvent[],
): SharedContentState {
  return events.reduce((next, event) => reduceSharedContentState(next, event), state);
}

export function reduceSharedContentState(
  state: SharedContentState,
  event: SharedContentEvent,
): SharedContentState {
  if (event.type === "identityChanged") {
    const nextGeneration = event.identityGeneration;
    if (!Number.isSafeInteger(nextGeneration) || nextGeneration <= 0) return state;
    if (
      event.identityId === state.identityId &&
      event.conversationId === state.conversationId &&
      nextGeneration === state.identityGeneration
    ) {
      return state;
    }

    if (nextGeneration <= state.identityGeneration) return state;

    return {
      ...createSharedContentState(
        event.identityId,
        event.conversationId,
        nextGeneration,
      ),
      status: "loading",
    };
  }

  if (!ownsEvent(state, event.identityId, event.conversationId, event.identityGeneration)) {
    return state;
  }

  switch (event.type) {
    case "requestStarted":
      return {
        ...state,
        conversationId: state.conversationId ?? event.conversationId,
        pendingPageRequest: {
          requestId: event.requestId,
          requestedCursor: copyCursor(event.requestedCursor),
          replace: event.replace,
        },
      };

    case "initialLoaded":
      return acceptPageCompletion(state, event, true, event.categories, event.status);

    case "pageLoaded":
      return acceptPageCompletion(state, event, false);

    case "realtimeItemReceived":
      if (!itemBelongsToConversation(state, event.item, event.conversationId)) return state;
      return mergeItems(state, [event.item]);

    case "sourceDeleted": {
      const alreadyDeleted = state.deletedSourceMessageIds.includes(event.sourceMessageId);
      return {
        ...state,
        items: state.items.filter(
          (item) => item.sourceMessageId !== event.sourceMessageId,
        ),
        pages: state.pages.map((page) => ({
          ...page,
          items: page.items.filter(
            (item) => item.sourceMessageId !== event.sourceMessageId,
          ),
        })),
        deletedSourceMessageIds: alreadyDeleted
          ? state.deletedSourceMessageIds
          : [...state.deletedSourceMessageIds, event.sourceMessageId],
      };
    }

    case "categoryAvailabilityUpdated":
      return { ...state, categories: [...event.categories] };

    case "galleryStatusChanged":
      return { ...state, status: event.status, error: event.error ?? null };

    case "referencesUpdated":
      return {
        ...state,
        deliveryReferences: [...event.deliveryReferences],
        temporaryReferences: [...event.temporaryReferences],
      };
  }
}

function ownsEvent(
  state: SharedContentState,
  identityId: string,
  conversationId: string,
  identityGeneration: number,
): boolean {
  return (
    state.identityId === identityId &&
    Number.isSafeInteger(identityGeneration) &&
    state.identityGeneration === identityGeneration &&
    (state.conversationId === null || state.conversationId === conversationId)
  );
}

function acceptPageCompletion(
  state: SharedContentState,
  event: Extract<SharedContentEvent, { type: "initialLoaded" | "pageLoaded" }>,
  replace: boolean,
  categories?: SharedContentState["categories"],
  status?: SharedContentState["status"],
): SharedContentState {
  if (
    state.pendingPageRequest === null ||
    state.pendingPageRequest.requestId !== event.requestId ||
    state.pendingPageRequest.replace !== replace ||
    !cursorsEqual(state.pendingPageRequest.requestedCursor, event.requestedCursor) ||
    event.page.items.some(
      (item) => !itemBelongsToConversation(state, item, event.conversationId),
    )
  ) {
    return state;
  }

  const page = normalizeAcceptedPage(state, event.page);
  const items = replace ? [] : state.items;
  const merged = mergeUniqueItems(items, page.items, state.deletedSourceMessageIds);
  const pages = replace ? [page] : appendPage(state.pages, page);

  return {
    ...state,
    conversationId: state.conversationId ?? event.conversationId,
    items: merged,
    pages,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    pendingPageRequest: null,
    categories: categories === undefined ? state.categories : [...categories],
    status: status ?? (merged.length > 0 ? "content" : "empty"),
    error: null,
  };
}

function normalizeAcceptedPage(
  state: SharedContentState,
  page: SharedContentPage,
): SharedContentPage {
  const deleted = new Set(state.deletedSourceMessageIds);
  const seen = new Set<string>();
  const items = page.items.filter((item) => {
    if (deleted.has(item.sourceMessageId) || seen.has(item.itemId)) return false;
    seen.add(item.itemId);
    return true;
  });
  return { ...page, items };
}

function mergeItems(
  state: SharedContentState,
  incoming: SharedContentItem[],
): SharedContentState {
  const merged = mergeUniqueItems(state.items, incoming, state.deletedSourceMessageIds);
  return merged.length === state.items.length
    ? state
    : {
        ...state,
        conversationId: state.conversationId ?? incoming[0]?.conversationId ?? null,
        items: merged,
        status: "content",
        error: null,
      };
}

function itemBelongsToConversation(
  state: SharedContentState,
  item: SharedContentItem,
  eventConversationId: string,
): boolean {
  return (
    item.conversationId === eventConversationId &&
    (state.conversationId === null || item.conversationId === state.conversationId)
  );
}

function cursorsEqual(
  left: SharedContentCursor | null,
  right: SharedContentCursor | null,
): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.sourceCreatedAt === right.sourceCreatedAt &&
    left.sourceMessageId === right.sourceMessageId &&
    left.sourceRank === right.sourceRank &&
    left.itemId === right.itemId
  );
}

function copyCursor(cursor: SharedContentCursor | null): SharedContentCursor | null {
  return cursor === null ? null : { ...cursor };
}

function mergeUniqueItems(
  existing: SharedContentItem[],
  incoming: SharedContentItem[],
  deletedSourceMessageIds: string[],
): SharedContentItem[] {
  const deleted = new Set(deletedSourceMessageIds);
  const result = existing.filter((item) => !deleted.has(item.sourceMessageId));
  const seen = new Set(result.map((item) => item.itemId));

  for (const item of incoming) {
    if (deleted.has(item.sourceMessageId) || seen.has(item.itemId)) continue;
    seen.add(item.itemId);
    result.push(item);
  }

  return result;
}

function appendPage(pages: SharedContentPage[], page: SharedContentPage): SharedContentPage[] {
  const incomingIds = new Set(page.items.map((item) => item.itemId));
  if (
    pages.some(
      (existing) =>
        existing.items.length === page.items.length &&
        existing.items.every((item) => incomingIds.has(item.itemId)),
    )
  ) {
    return pages;
  }
  return [...pages, page];
}

type Phase12Projection = Record<string, unknown>;

export function hydrateSharedContentCache(
  input: SharedContentCacheHydrationInput,
): SharedContentCacheHydrationResult;
export function hydrateSharedContentCache(input: Phase12Projection): Phase12Projection;
export function hydrateSharedContentCache(
  input: SharedContentCacheHydrationInput | Phase12Projection,
): SharedContentCacheHydrationResult | Phase12Projection {
  if ("source" in input && "hasCache" in input) {
    return { ...projectSharedContentPresentation(input) };
  }

  if ("deliveryUrl" in input) {
    return projectSharedContentDeliveryRedaction(input);
  }

  if ("fromOwner" in input || "cachedOwner" in input || "currentOwner" in input) {
    return projectSharedContentGeneration(input);
  }

  const hydration = input as SharedContentCacheHydrationInput;
  const eligible =
    hydration.ownerIdentityId === hydration.verifiedIdentityId &&
    hydration.verifiedIdentityId !== null &&
    hydration.cacheIdentityGeneration === hydration.currentIdentityGeneration;

  return eligible
    ? {
        eligible: true,
        itemIds: [...hydration.cachedItemIds],
        unavailableReason: "none",
        identityIneligible: false,
      }
    : {
        eligible: false,
        itemIds: [],
        unavailableReason: "identity-ineligible",
        identityIneligible: true,
      };
}

export function projectSharedContentPresentation(
  input: Phase12Projection,
): SharedContentPresentationContract {
  const source = input.source as SharedContentPresentationContract["source"];
  const hasCache = input.hasCache === true;
  const stale = input.stale === true;
  const retainedHistoryComplete = input.retainedHistoryComplete === true;
  const networkUsable = input.networkUsable === true;
  const authoritativeEmptyConfirmed = input.authoritativeEmptyConfirmed === true;

  let unavailableReason: SharedContentPresentationContract["unavailableReason"] = "none";
  if (authoritativeEmptyConfirmed && source === "authoritative") {
    unavailableReason = "authoritative-empty";
  } else if (!hasCache && !networkUsable) {
    unavailableReason = "offline-no-cache";
  }

  const notice: SharedContentPresentationContract["notice"] =
    hasCache && !networkUsable
      ? "offline-cached"
      : stale
        ? "stale"
        : "none";
  const boundary: SharedContentPresentationContract["boundary"] = retainedHistoryComplete
    ? "none"
    : networkUsable
      ? "online-incomplete"
      : "offline-incomplete";

  return {
    source,
    stale,
    retainedHistoryComplete,
    notice,
    boundary,
    unavailableReason,
    manualRetry: (input.manualRetry as SharedContentPresentationContract["manualRetry"]) ?? "hidden",
  };
}

function projectSharedContentDeliveryRedaction(input: Phase12Projection): Phase12Projection {
  if ("itemId" in input) {
    return {
      persistedSnapshot: { itemId: String(input.itemId) },
      diagnostics: {
        operation: "delivery-refresh",
        outcome: "success",
        failureCategory: null,
      },
      sentinelDurableCount: 0,
    };
  }

  return {
    persistedFields: [],
    diagnosticFields: ["operation", "outcome", "durationMs", "failureCategory"],
    sentinelDurableCount: 0,
  };
}

function projectSharedContentGeneration(input: Phase12Projection): Phase12Projection {
  const accepted =
    input.currentOwner !== null &&
    input.callbackOwner === input.currentOwner &&
    input.callbackConversation === input.currentConversation &&
    input.callbackGeneration === input.currentGeneration;
  const identityAccepted =
    input.currentOwner !== null &&
    input.fromOwner !== undefined &&
    input.toOwner !== undefined &&
    input.fromGeneration !== undefined &&
    input.toGeneration !== undefined;

  if ("fromOwner" in input) {
    return {
      order: [
        "revoke-generation",
        "hide-old-state",
        "cancel-work",
        "purge-layers",
        "verify-purge",
        "bind-new-owner",
      ],
      oldOwnerVisible: false,
      newOwnerAccepted: identityAccepted,
    };
  }

  if ("cachedOwner" in input) {
    return {
      accepted: false,
      visibleItemIds: [],
      unavailableReason: "identity-ineligible",
      oldOwnerEligible: false,
    };
  }

  return {
    accepted,
    visibleItemIds: accepted ? ["content-01"] : [],
    oldOwnerEligible: accepted,
  };
}

export function sharedContentRecoveryDelayMs(jitterMs = 0): number {
  const jitter = Math.max(0, Math.min(SHARED_CONTENT_CACHE_LIMITS.retryJitterMaxMs, Math.trunc(jitterMs)));
  return SHARED_CONTENT_CACHE_LIMITS.retryBaseMs + jitter;
}

export function beginSharedContentRecoveryCycle(
  input: SharedContentRecoveryInput,
): Phase12Projection {
  const previousNumber = input.cycleId === null || input.cycleId === undefined
    ? 0
    : Number.parseInt(input.cycleId.replace("cycle-", ""), 10) || 0;
  const cycleId = `cycle-${previousNumber + 1}`;
  const result: Phase12Projection = {
    cycleId,
    phase: "refreshing",
    attempt: 0,
    automaticAttempts: [0],
  };
  if (input.trigger === "manual-retry") {
    result.manualRetry = "hidden";
  } else {
    result.joinedTriggerCount = input.triggers?.length ?? 1;
  }
  return result;
}

export function failSharedContentRecoveryAttempt(
  input: SharedContentRecoveryInput,
): Phase12Projection {
  if (!input.networkUsable) {
    return {
      cycleId: input.cycleId ?? null,
      phase: "idle",
      attempt: input.attempt ?? 0,
      manualRetry: "hidden",
      retryScheduled: false,
    };
  }

  if (input.phase === "refreshing" && input.attempt === 0) {
    return {
      cycleId: input.cycleId ?? null,
      phase: "retry-backoff",
      attempt: 1,
      retryDelayMs: sharedContentRecoveryDelayMs(input.jitterMs ?? 0),
      manualRetry: "hidden",
    };
  }

  return {
    cycleId: input.cycleId ?? null,
    phase: "manual-retry",
    attempt: 1,
    automaticAttempts: [0, 1],
    manualRetry: "enabled",
    automaticAttemptTwo: false,
  };
}

export function completeSharedContentRecoveryCycle(
  input: SharedContentRecoveryInput,
): Phase12Projection {
  if (!input.networkUsable && input.phase === "retry-backoff") {
    return {
      cycleId: input.cycleId ?? null,
      phase: "idle",
      attempt: input.attempt ?? 0,
      manualRetry: "hidden",
      retryScheduled: false,
    };
  }

  return {
    cycleId: input.cycleId ?? null,
    phase: "idle",
    attempt: input.attempt ?? 0,
    manualRetry: "hidden",
    retryScheduled: false,
  };
}

export function planSharedContentDeliveryBatches(
  input: SharedContentDeliveryPlanningInput,
): SharedContentDeliveryPlanningResult {
  const batches: SharedContentDeliveryBatch[] = [];
  const append = (intent: SharedContentDeliveryBatch["intent"], ids: string[]) => {
    const unique = [...new Set(ids)];
    for (let offset = 0; offset < unique.length; offset += SHARED_CONTENT_CACHE_LIMITS.deliveryBatchMax) {
      batches.push({
        intent,
        ids: unique.slice(offset, offset + SHARED_CONTENT_CACHE_LIMITS.deliveryBatchMax),
      });
    }
  };

  const visible = [...new Set(input.visibleIds)];
  append("visible-thumbnail", visible);

  if (input.lookaheadAllowed) {
    const visibleIds = new Set(visible);
    append("lookahead-thumbnail", input.lookaheadIds.filter((id) => !visibleIds.has(id)));
  }

  append("selected-full-content", [...new Set(input.selectedIds)]);
  return {
    ...(input.lookaheadIds.length > 0 ? { lookaheadAllowed: input.lookaheadAllowed } : {}),
    batches,
  };
}

export function projectSharedContentEviction(input: Phase12Projection): Phase12Projection {
  if ("perConversationItemCount" in input) {
    return {
      newestProtectedCount: SHARED_CONTENT_CACHE_LIMITS.newestProtectedCount,
      perConversationLimit: SHARED_CONTENT_CACHE_LIMITS.perConversationItemLimit,
      evictedItemIds: input.perConversationItemCount === SHARED_CONTENT_CACHE_LIMITS.perConversationItemLimit + 1
        ? ["browsed-oldest"]
        : [],
      retainedNewestWindow: input.activeConversation === true,
    };
  }

  if ("pages" in input) {
    return {
      evictPageIds: ["oldest"],
      preservePageIds: ["newest"],
    };
  }

  return {
    perAccountByteLimit: SHARED_CONTENT_CACHE_LIMITS.thumbnailBytesPerAccount,
    inactivityWindowMs: SHARED_CONTENT_CACHE_LIMITS.inactivityWindowMs,
    evictLeastRecentFirst: true,
  };
}
