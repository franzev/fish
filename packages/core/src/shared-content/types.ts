export type SharedContentCategory = "media" | "files" | "links" | "voice";

export type SharedContentKind =
  | "photo"
  | "video"
  | "gif"
  | "sticker"
  | "document"
  | "link"
  | "voice";

export type SharedContentSourceKind = "attachment" | "gif" | "sticker" | "link";

export const SHARED_CONTENT_CACHE_SCHEMA_VERSION = 1 as const;

export interface SharedContentCacheLimits {
  newestProtectedCount: 40;
  perConversationItemLimit: 400;
  perAccountItemLimit: 2000;
  thumbnailBytesPerAccount: 67_108_864;
  inactivityWindowMs: 2_592_000_000;
  meaningfulForegroundMs: 300_000;
  triggerCoalescingMs: 500;
  retryBaseMs: 1_000;
  retryJitterMaxMs: 250;
  deliveryFreshnessMarginMs: 120_000;
  deliveryBatchMax: 50;
}

export const SHARED_CONTENT_CACHE_LIMITS: SharedContentCacheLimits = Object.freeze({
  newestProtectedCount: 40,
  perConversationItemLimit: 400,
  perAccountItemLimit: 2_000,
  thumbnailBytesPerAccount: 67_108_864,
  inactivityWindowMs: 2_592_000_000,
  meaningfulForegroundMs: 300_000,
  triggerCoalescingMs: 500,
  retryBaseMs: 1_000,
  retryJitterMaxMs: 250,
  deliveryFreshnessMarginMs: 120_000,
  deliveryBatchMax: 50,
});

export type SharedContentCacheSource = "none" | "verified-device-cache" | "authoritative";

export interface SharedContentCacheTruth {
  source: SharedContentCacheSource;
  stale: boolean;
  retainedHistoryComplete: boolean;
}

export type SharedContentRecoveryPhase = "idle" | "refreshing" | "retry-backoff" | "manual-retry";

export interface SharedContentRecoveryState {
  cycleId: string | null;
  phase: SharedContentRecoveryPhase;
  attempt: 0 | 1;
  joinedTriggerCount: number;
  automaticAttempts: Array<0 | 1>;
  retryScheduled: boolean;
  retryDelayMs: number | null;
  manualRetry: SharedContentManualRetryState;
}

export type SharedContentFetchIntent =
  | "visible-thumbnail"
  | "lookahead-thumbnail"
  | "selected-full-content";

export interface SharedContentNetworkPolicy {
  networkUsable: boolean;
  lookaheadAllowed: boolean;
}

export interface SharedContentCachedAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
}

export interface SharedContentCachedGif {
  provider: string;
  providerContentId: string;
  title?: string;
  description?: string;
}

export interface SharedContentCachedLink {
  url: string;
  hostname: string;
  title?: string;
  description?: string;
  siteName?: string;
}

/** Owner-scoped metadata safe to retain; delivery and filesystem references are excluded. */
export interface SharedContentCachedItem {
  itemId: string;
  conversationId: string;
  sourceMessageId: string;
  senderId: string;
  sourceCreatedAt: string;
  sourceRank: number;
  category: SharedContentCategory;
  kind: SharedContentKind;
  /** Trusted nullable listing metadata; never delivery or action authority. */
  durationMs?: number;
  attachment?: SharedContentCachedAttachment;
  gif?: SharedContentCachedGif;
  stickerId?: string;
  link?: SharedContentCachedLink;
}

export interface SharedContentCachedSnapshot {
  schemaVersion: typeof SHARED_CONTENT_CACHE_SCHEMA_VERSION;
  ownerIdentityId: string;
  conversationId: string;
  identityGeneration: number;
  items: SharedContentCachedItem[];
  source: SharedContentCacheSource;
  stale: boolean;
  retainedHistoryComplete: boolean;
}

export type SharedContentPresentationNotice =
  | "none"
  | "checking-for-updates"
  | "offline-cached"
  | "stale";

export type SharedContentHistoryBoundary = "none" | "online-incomplete" | "offline-incomplete";

export type SharedContentUnavailableReason =
  | "none"
  | "loading"
  | "authoritative-empty"
  | "offline-no-cache"
  | "identity-ineligible"
  | "authority-unavailable";

export type SharedContentManualRetryState = "hidden" | "enabled" | "busy";

export interface SharedContentPresentationContract extends SharedContentCacheTruth {
  notice: SharedContentPresentationNotice;
  boundary: SharedContentHistoryBoundary;
  unavailableReason: SharedContentUnavailableReason;
  manualRetry: SharedContentManualRetryState;
}

export interface SharedContentCacheHydrationInput {
  ownerIdentityId: string;
  verifiedIdentityId: string | null;
  conversationId: string;
  cachedItemIds: string[];
  cacheIdentityGeneration: number;
  currentIdentityGeneration: number;
}

export interface SharedContentCacheHydrationResult {
  eligible: boolean;
  itemIds: string[];
  unavailableReason: SharedContentUnavailableReason;
  identityIneligible: boolean;
}

export interface SharedContentRecoveryInput extends Partial<SharedContentRecoveryState> {
  triggers?: string[];
  trigger?: string;
  networkUsable: boolean;
  jitterMs?: number;
}

export interface SharedContentDeliveryPlanningInput extends SharedContentNetworkPolicy {
  visibleIds: string[];
  lookaheadIds: string[];
  selectedIds: string[];
}

export interface SharedContentDeliveryBatch {
  intent: SharedContentFetchIntent;
  ids: string[];
}

export interface SharedContentDeliveryPlanningResult {
  lookaheadAllowed?: boolean;
  batches: SharedContentDeliveryBatch[];
}

export type SharedContentAttachmentStatus =
  | "pending"
  | "uploaded"
  | "processing"
  | "pending_scan"
  | "ready"
  | "failed"
  | "cancelled";

export type SharedContentAttachmentKind = "image" | "file";

/** Persisted fields that are safe for the pure classifier to inspect. */
export interface SharedContentSourceDescriptor {
  itemId: string;
  conversationId: string;
  sourceMessageId: string;
  sourceCreatedAt: string;
  senderId: string;
  sourceKind: SharedContentSourceKind;
  sourceDeleted: boolean;
  attachmentStatus?: SharedContentAttachmentStatus;
  attachmentKind?: SharedContentAttachmentKind;
  boundToSource?: boolean;
  storedMimeType?: string;
  attachmentId?: string;
  originalName?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  /** Trusted nullable listing metadata; never delivery or action authority. */
  durationMs?: number;
  displayPath?: string;
  thumbnailPath?: string;
  gifProvider?: string;
  gifProviderContentId?: string;
  gifTitle?: string;
  gifDescription?: string;
  stickerId?: string;
  linkUrl?: string;
  linkHostname?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkSiteName?: string;
}

export interface SharedContentAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  displayPath: string;
  thumbnailPath?: string;
}

export interface SharedContentGif {
  provider: string;
  providerContentId: string;
  title?: string;
  description?: string;
}

export interface SharedContentLink {
  url: string;
  hostname: string;
  title?: string;
  description?: string;
  siteName?: string;
}

export interface SharedContentCapabilities {
  canDelete: boolean;
  canExport: boolean;
}

export interface SharedContentItem {
  itemId: string;
  conversationId: string;
  sourceMessageId: string;
  senderId: string;
  sourceCreatedAt: string;
  sourceRank: number;
  category: SharedContentCategory;
  kind: SharedContentKind;
  /** Trusted nullable listing metadata; never delivery or action authority. */
  durationMs?: number;
  attachment?: SharedContentAttachment;
  gif?: SharedContentGif;
  stickerId?: string;
  link?: SharedContentLink;
  capabilities: SharedContentCapabilities;
}

export interface SharedContentClassification {
  category: SharedContentCategory;
  kind: SharedContentKind;
}

export interface SharedContentCursor {
  sourceCreatedAt: string;
  sourceMessageId: string;
  sourceRank: number;
  itemId: string;
}

export interface SharedContentPage {
  items: SharedContentItem[];
  hasMore: boolean;
  nextCursor: SharedContentCursor | null;
}

export interface SharedContentPageRequest {
  requestId: string;
  requestedCursor: SharedContentCursor | null;
  replace: boolean;
}

export type SharedContentGalleryStatus =
  | "loading"
  | "content"
  | "empty"
  | "incomplete"
  | "stale"
  | "unavailable"
  | "terminal-error";

export interface SharedContentState {
  identityId: string | null;
  conversationId: string | null;
  identityGeneration: number;
  items: SharedContentItem[];
  pages: SharedContentPage[];
  nextCursor: SharedContentCursor | null;
  hasMore: boolean;
  pendingPageRequest: SharedContentPageRequest | null;
  categories: SharedContentCategory[];
  status: SharedContentGalleryStatus;
  deliveryReferences: string[];
  temporaryReferences: string[];
  error: string | null;
  deletedSourceMessageIds: string[];
}

export type SharedContentEvent =
  | {
      type: "identityChanged";
      identityId: string;
      conversationId: string | null;
      identityGeneration: number;
    }
  | {
      type: "requestStarted";
      identityId: string;
      conversationId: string;
      identityGeneration: number;
      requestId: string;
      requestedCursor: SharedContentCursor | null;
      replace: boolean;
    }
  | {
      type: "initialLoaded";
      identityId: string;
      conversationId: string;
      identityGeneration: number;
      requestId: string;
      requestedCursor: SharedContentCursor | null;
      page: SharedContentPage;
      categories?: SharedContentCategory[];
      status?: SharedContentGalleryStatus;
    }
  | {
      type: "pageLoaded";
      identityId: string;
      conversationId: string;
      identityGeneration: number;
      requestId: string;
      requestedCursor: SharedContentCursor | null;
      page: SharedContentPage;
    }
  | {
      type: "realtimeItemReceived";
      identityId: string;
      conversationId: string;
      identityGeneration: number;
      item: SharedContentItem;
    }
  | {
      type: "sourceDeleted";
      identityId: string;
      conversationId: string;
      identityGeneration: number;
      sourceMessageId: string;
    }
  | {
      type: "categoryAvailabilityUpdated";
      identityId: string;
      conversationId: string;
      identityGeneration: number;
      categories: SharedContentCategory[];
    }
  | {
      type: "galleryStatusChanged";
      identityId: string;
      conversationId: string;
      identityGeneration: number;
      status: SharedContentGalleryStatus;
      error?: string | null;
    }
  | {
      type: "referencesUpdated";
      identityId: string;
      conversationId: string;
      identityGeneration: number;
      deliveryReferences: string[];
      temporaryReferences: string[];
    };
