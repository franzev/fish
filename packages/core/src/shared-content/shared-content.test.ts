import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { classifySharedContentSource } from "./classification.ts";
import { compareSharedContentItems as compareItems, pageFromRows as makePage } from "./ordering.ts";
import {
  applySharedContentEvents,
  createSharedContentState,
  projectSharedContentEviction,
  reduceSharedContentState,
} from "./state.ts";
import * as phase12State from "./state.ts";
import * as phase12Types from "./types.ts";
import type {
  SharedContentCategory,
  SharedContentCursor,
  SharedContentEvent,
  SharedContentItem,
  SharedContentPage,
  SharedContentSourceDescriptor,
} from "./types.ts";

interface ClassificationCase {
  name: string;
  source: SharedContentSourceDescriptor;
  conversationId?: string;
  expected: { category: string; kind: string } | null;
}

interface OrderingCase {
  name: string;
  itemIds: string[];
  expectedItemIds: string[];
}

interface PaginationCase {
  name: string;
  p_limit: number;
  rows: string[];
  pageSize: number;
  expected: {
    itemIds: string[];
    hasMore: boolean;
    cursor: {
      sourceCreatedAt: string;
      sourceMessageId: string;
      sourceRank: number;
      itemId: string;
    } | null;
  };
}

interface SharedContentVectors {
  metadata: {
    version: number;
    expectedCaseCount: number;
    expectedTask1CaseCount: number;
    groups: string[];
  };
  items: Record<string, SharedContentItem>;
  classification: { cases: ClassificationCase[] };
  ordering: { cases: OrderingCase[] };
  pagination: { cases: PaginationCase[] };
  permissions: { cases: PermissionCase[] };
  galleryStates: { cases: Array<{ name: string; status: string }> };
  identityPurge: { cases: Array<StateCase> };
  deletionFanOut: { cases: Array<StateCase> };
  requestSequencing: { cases: Array<StateCase> };
  cacheHydration: { cases: Phase12Case[] };
  cacheTruth: { cases: Phase12Case[] };
  eviction: { cases: Phase12Case[] };
  recovery: { cases: Phase12Case[] };
  deliveryPlanning: { cases: Phase12Case[] };
  dataSaving: { cases: Phase12Case[] };
  urlNonPersistence: { cases: Phase12Case[] };
  identityGeneration: { cases: Phase12Case[] };
}

interface Phase12Case {
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
}

interface PermissionCase {
  name: string;
  expected: Record<string, unknown>;
}

interface StateCase {
  name: string;
  initial: {
    identityId: string;
    conversationId: string;
    itemIds?: string[];
    sourceMessageIds?: string[];
    categories?: SharedContentCategory[];
    deliveryReferences?: string[];
    temporaryReferences?: string[];
    error?: string;
    deletedSourceMessageIds?: string[];
  };
  events: Array<Record<string, unknown>>;
  expected: Record<string, unknown>;
}

const fixturePath = new URL("./fixtures/shared-content-vectors.json", import.meta.url);
const vectors = JSON.parse(readFileSync(fixturePath, "utf8")) as SharedContentVectors;

const completeStateProjectionKeys = [
  "identityId",
  "conversationId",
  "items",
  "pages",
  "nextCursor",
  "hasMore",
  "pendingPageRequest",
  "categories",
  "status",
  "error",
  "deliveryReferences",
  "temporaryReferences",
  "deletedSourceMessageIds",
] as const;

test("the canonical fixture metadata has the fixed Task 1 case count", () => {
  assert.equal(vectors.metadata.version, 3);
  assert.deepEqual(vectors.metadata.groups, [
    "classification",
    "ordering",
    "pagination",
    "permissions",
    "galleryStates",
    "identityPurge",
    "deletionFanOut",
    "requestSequencing",
    "cacheHydration",
    "cacheTruth",
    "eviction",
    "recovery",
    "deliveryPlanning",
    "dataSaving",
    "urlNonPersistence",
    "identityGeneration",
  ]);
  const task1CaseCount =
    vectors.classification.cases.length +
    vectors.ordering.cases.length +
    vectors.pagination.cases.length +
    vectors.requestSequencing.cases.length;
  const totalCaseCount = vectors.metadata.groups.reduce(
    (count, group) => {
      const groupValue = vectors[group as keyof SharedContentVectors];
      if (!("cases" in groupValue)) throw new Error(`Group has no cases: ${group}`);
      return count + (groupValue as { cases: unknown[] }).cases.length;
    },
    0,
  );

  assert.equal(task1CaseCount, vectors.metadata.expectedTask1CaseCount);
  assert.equal(totalCaseCount, vectors.metadata.expectedCaseCount);
  assert.equal(totalCaseCount, 92);
});

test("the canonical fixture rejects unknown top-level groups and Phase 12 case keys", () => {
  assert.deepEqual(Object.keys(vectors).sort(), [
    "cacheHydration",
    "cacheTruth",
    "classification",
    "dataSaving",
    "deletionFanOut",
    "deliveryPlanning",
    "eviction",
    "galleryStates",
    "identityGeneration",
    "identityPurge",
    "items",
    "metadata",
    "ordering",
    "pagination",
    "permissions",
    "recovery",
    "requestSequencing",
    "urlNonPersistence",
  ]);

  for (const group of [
    "cacheHydration",
    "cacheTruth",
    "eviction",
    "recovery",
    "deliveryPlanning",
    "dataSaving",
    "urlNonPersistence",
    "identityGeneration",
  ] as const) {
    for (const vector of vectors[group].cases) {
      assert.deepEqual(Object.keys(vector).sort(), ["expected", "input", "name"], `${group}:${vector.name}`);
      assert.equal(typeof vector.name, "string", `${group}:${vector.name}`);
      assert.equal(typeof vector.input, "object", `${group}:${vector.name}`);
      assert.equal(typeof vector.expected, "object", `${group}:${vector.name}`);
    }
  }
});

test("classification vectors map only hardened persisted sources", () => {
  for (const vector of vectors.classification.cases) {
    assert.deepEqual(
      classifySharedContentSource(vector.source, vector.conversationId),
      vector.expected,
      vector.name,
    );
  }
});

test("ordering vectors use deterministic descending source and C/codepoint item order", () => {
  for (const vector of vectors.ordering.cases) {
    const sorted = vector.itemIds
      .map(requireFixtureItem)
      .sort(compareItems);
    assert.deepEqual(sorted.map((item) => item.itemId), vector.expectedItemIds, vector.name);
  }
});

test("pagination vectors retain the page and cursor from the last retained row", () => {
  for (const vector of vectors.pagination.cases) {
    assert.equal(vector.p_limit, 40, `${vector.name}: RPC p_limit`);
    assert.equal(vector.pageSize <= 40, true, vector.name);
    assert.equal(vector.rows.length <= 41, true, `${vector.name}: response exceeds 40+1`);
    const page = makePage(vector.rows.map(requireFixtureItem), vector.pageSize);
    assert.deepEqual(
      {
        itemIds: page.items.map((item) => item.itemId),
        hasMore: page.hasMore,
        cursor: page.nextCursor,
      },
      vector.expected,
      vector.name,
    );
  }
});

function requirePhase12Function(name: string): (...args: unknown[]) => unknown {
  const implementation = (phase12State as unknown as Record<string, unknown>)[name];
  assert.equal(typeof implementation, "function", `missing Phase 12 export: ${name}`);
  return implementation as (...args: unknown[]) => unknown;
}

function phase12Projection(vector: Phase12Case, exportName: string): unknown {
  return requirePhase12Function(exportName)(vector.input);
}

test("Phase 12 cache hydration and truthful-state vectors use complete projections", () => {
  for (const group of ["cacheHydration", "cacheTruth", "urlNonPersistence", "identityGeneration"] as const) {
    for (const vector of vectors[group].cases) {
      assert.deepEqual(
        phase12Projection(vector, "hydrateSharedContentCache"),
        vector.expected,
        `${group}:${vector.name}`,
      );
    }
  }
});

test("Phase 12 eviction vectors preserve bounded metadata and thumbnail limits", () => {
  for (const vector of vectors.eviction.cases) {
    assert.deepEqual(projectSharedContentEviction(vector.input), vector.expected, `eviction:${vector.name}`);
  }
});

test("Phase 12 constants preserve the resolved bounded cache and delivery limits", () => {
  const limits = (phase12Types as unknown as Record<string, unknown>)["SHARED_CONTENT_CACHE_LIMITS"];
  assert.deepEqual(limits, {
    newestProtectedCount: 40,
    perConversationItemLimit: 400,
    perAccountItemLimit: 2000,
    thumbnailBytesPerAccount: 67108864,
    inactivityWindowMs: 2592000000,
    meaningfulForegroundMs: 300000,
    triggerCoalescingMs: 500,
    retryBaseMs: 1000,
    retryJitterMaxMs: 250,
    deliveryFreshnessMarginMs: 120000,
    deliveryBatchMax: 50,
  });
});

test("Phase 12 recovery vectors allow only two automatic attempts and explicit reset", () => {
  const begin = requirePhase12Function("beginSharedContentRecoveryCycle");
  const fail = requirePhase12Function("failSharedContentRecoveryAttempt");
  const complete = requirePhase12Function("completeSharedContentRecoveryCycle");
  for (const vector of vectors.recovery.cases) {
    const actual = vector.name === "attemptZeroFailureSchedulesAttemptOne"
      ? fail(vector.input)
      : vector.name === "attemptOneFailureEnablesManualRetry" || vector.name === "connectivityLossCancelsDelayedRetry"
        ? fail(vector.input)
        : vector.name === "manualRetryStartsNewCycle"
          ? begin(vector.input)
          : vector.name === "triggerBurstJoinsOneCycle"
            ? begin(vector.input)
            : complete(vector.input);
    assert.deepEqual(actual, vector.expected, `recovery:${vector.name}`);
  }
});

test("Phase 12 delivery vectors preserve intent priority, deduplication, and 50-ID batches", () => {
  const plan = requirePhase12Function("planSharedContentDeliveryBatches");
  for (const group of ["deliveryPlanning", "dataSaving"] as const) {
    for (const vector of vectors[group].cases) {
      const actual = plan(vector.input as never) as Record<string, unknown>;
      assert.deepEqual(
        group === "deliveryPlanning" ? actual.batches : actual,
        group === "deliveryPlanning" ? vector.expected.batches : vector.expected,
        `${group}:${vector.name}`,
      );
    }
  }
});

test("permission and gallery vectors preserve the shared capability and state vocabulary", () => {
  for (const vector of vectors.permissions.cases) {
    assert.equal(typeof vector.expected, "object", vector.name);
  }

  const statuses = new Set([
    "loading",
    "content",
    "empty",
    "incomplete",
    "stale",
    "unavailable",
    "terminal-error",
  ]);
  for (const vector of vectors.galleryStates.cases) {
    assert.equal(statuses.has(vector.status), true, vector.name);
  }

  const gif = vectors.items["ord-message-b"];
  assert.equal(gif.capabilities.canExport, false);
});

function materializeItems(
  itemIds: string[],
  sourceMessageIds?: string[],
): SharedContentItem[] {
  return itemIds.map((itemId, index) => ({
    ...requireFixtureItem(itemId),
    sourceMessageId: sourceMessageIds?.[index] ?? requireFixtureItem(itemId).sourceMessageId,
  }));
}

function requireFixtureItem(itemId: string): SharedContentItem {
  const item = vectors.items[itemId];
  if (item === undefined) throw new Error(`Unknown shared-content fixture item: ${itemId}`);
  return item;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing or invalid ${label}`);
  }
  return value;
}

function requireCursor(value: unknown, label: string): SharedContentCursor | null {
  if (value === null) return null;
  if (typeof value !== "object" || value === null) {
    throw new Error(`Missing or invalid ${label}`);
  }
  const cursor = value as Record<string, unknown>;
  for (const key of ["sourceCreatedAt", "sourceMessageId", "sourceRank", "itemId"]) {
    if (!(key in cursor)) throw new Error(`Missing ${label}.${key}`);
  }
  return {
    sourceCreatedAt: String(cursor.sourceCreatedAt),
    sourceMessageId: String(cursor.sourceMessageId),
    sourceRank: Number(cursor.sourceRank),
    itemId: String(cursor.itemId),
  };
}

function materializeEvent(event: Record<string, unknown>): SharedContentEvent {
  const identityId = requireString(event.identityId, "event.identityId");
  const conversationId = requireString(event.conversationId, "event.conversationId");

  switch (event.type) {
    case "sourceDeleted":
      return {
        type: "sourceDeleted",
        identityId,
        conversationId,
        identityGeneration: typeof event.identityGeneration === "number" ? event.identityGeneration : 1,
        sourceMessageId: requireString(event.sourceMessageId, "sourceDeleted.sourceMessageId"),
      };
    case "pageLoaded": {
      const itemIds = event.itemIds as string[];
      const sourceMessageIds = event.sourceMessageIds as string[] | undefined;
      return {
        type: "pageLoaded",
        identityId,
        conversationId,
        identityGeneration: typeof event.identityGeneration === "number" ? event.identityGeneration : 1,
        requestId: requireString(event.requestId, "pageLoaded.requestId"),
        requestedCursor: requireCursor(event.requestedCursor, "pageLoaded.requestedCursor"),
        page: makePage(materializeItems(itemIds, sourceMessageIds)),
      } as unknown as SharedContentEvent;
    }
    case "initialLoaded": {
      const itemIds = event.itemIds as string[];
      return {
        type: "initialLoaded",
        identityId,
        conversationId,
        identityGeneration: typeof event.identityGeneration === "number" ? event.identityGeneration : 1,
        requestId: requireString(event.requestId, "initialLoaded.requestId"),
        requestedCursor: requireCursor(event.requestedCursor, "initialLoaded.requestedCursor"),
        page: makePage(materializeItems(itemIds, event.sourceMessageIds as string[] | undefined)),
      } as unknown as SharedContentEvent;
    }
    case "requestStarted":
      return {
        type: "requestStarted",
        identityId,
        conversationId,
        identityGeneration: typeof event.identityGeneration === "number" ? event.identityGeneration : 1,
        requestId: requireString(event.requestId, "requestStarted.requestId"),
        requestedCursor: requireCursor(event.requestedCursor, "requestStarted.requestedCursor"),
        replace: (() => {
          if (typeof event.replace !== "boolean") throw new Error("Missing or invalid requestStarted.replace");
          return event.replace;
        })(),
      } as unknown as SharedContentEvent;
    case "realtimeItemReceived": {
      const itemId = String(event.itemId);
      return {
        type: "realtimeItemReceived",
        identityId,
        conversationId,
        identityGeneration: typeof event.identityGeneration === "number" ? event.identityGeneration : 1,
        item: {
          ...requireFixtureItem(itemId),
          ...(event.sourceMessageId === undefined
            ? {}
            : { sourceMessageId: String(event.sourceMessageId) }),
        },
      } as unknown as SharedContentEvent;
    }
    case "identityChanged":
      return {
        type: "identityChanged",
        identityId,
        conversationId: event.conversationId === null ? null : conversationId,
        identityGeneration: typeof event.identityGeneration === "number" ? event.identityGeneration : 2,
      };
    default:
      throw new Error(`Unsupported state fixture event: ${String(event.type)}`);
  }
}

function replayStateCase(vector: StateCase) {
  let state = createSharedContentState(vector.initial.identityId, vector.initial.conversationId);
  const initialItems = materializeItems(
    vector.initial.itemIds ?? [],
    vector.initial.sourceMessageIds,
  );
  const initialPage: SharedContentPage = makePage(initialItems);
  state = applySharedContentEvents(state, [
    {
      type: "requestStarted",
      identityId: vector.initial.identityId,
      conversationId: vector.initial.conversationId,
      identityGeneration: 1,
      requestId: "bootstrap",
      requestedCursor: null,
      replace: true,
    },
    {
      type: "initialLoaded",
      identityId: vector.initial.identityId,
      conversationId: vector.initial.conversationId,
      identityGeneration: 1,
      requestId: "bootstrap",
      requestedCursor: null,
      page: initialPage,
      categories: vector.initial.categories,
      status: "content",
    },
    ...(vector.initial.categories === undefined
      ? []
      : [{
          type: "categoryAvailabilityUpdated" as const,
          identityId: vector.initial.identityId,
          conversationId: vector.initial.conversationId,
          identityGeneration: 1,
          categories: vector.initial.categories,
        }]),
    ...(vector.initial.deliveryReferences === undefined
      ? []
      : [{
          type: "referencesUpdated" as const,
          identityId: vector.initial.identityId,
          conversationId: vector.initial.conversationId,
          identityGeneration: 1,
          deliveryReferences: vector.initial.deliveryReferences,
          temporaryReferences: vector.initial.temporaryReferences ?? [],
        }]),
    ...(vector.initial.error === undefined
      ? []
      : [{
          type: "galleryStatusChanged" as const,
          identityId: vector.initial.identityId,
          conversationId: vector.initial.conversationId,
          identityGeneration: 1,
          status: "stale" as const,
          error: vector.initial.error,
        }]),
  ]);
  return applySharedContentEvents(
    state,
    vector.events.map(materializeEvent),
  );
}

function stateProjection(state: ReturnType<typeof createSharedContentState>) {
  return {
    identityId: state.identityId,
    conversationId: state.conversationId,
    itemIds: state.items.map((item) => item.itemId),
    items: state.items,
    pages: state.pages,
    nextCursor: state.nextCursor,
    hasMore: state.hasMore,
    pendingPageRequest: state.pendingPageRequest,
    categories: state.categories,
    deliveryReferences: state.deliveryReferences,
    temporaryReferences: state.temporaryReferences,
    error: state.error,
    deletedSourceMessageIds: state.deletedSourceMessageIds,
    status: state.status,
  };
}

test("identity and deletion vectors replay through the pure reducer", () => {
  for (const vector of [
    ...vectors.identityPurge.cases,
    ...vectors.deletionFanOut.cases,
  ]) {
    assert.deepEqual(Object.keys(vector.expected).sort(), [...completeStateProjectionKeys].sort(), vector.name);
    const actual = stateProjection(replayStateCase(vector));
    for (const [key, expected] of Object.entries(vector.expected)) {
      assert.deepEqual(actual[key as keyof typeof actual], expected, vector.name);
    }
  }
});

function replayRequestSequencingCase(vector: StateCase) {
  let state = createSharedContentState(vector.initial.identityId, vector.initial.conversationId);
  const initialItems = materializeItems(
    vector.initial.itemIds ?? [],
    vector.initial.sourceMessageIds,
  );
  const bootstrap = {
    type: "requestStarted" as const,
    identityId: vector.initial.identityId,
    conversationId: vector.initial.conversationId,
    identityGeneration: 1,
    requestId: "bootstrap",
    requestedCursor: null,
    replace: true,
  };
  if (initialItems.length > 0) {
    state = applySharedContentEvents(state, [
      bootstrap,
      {
        type: "initialLoaded",
        identityId: vector.initial.identityId,
        conversationId: vector.initial.conversationId,
        identityGeneration: 1,
        requestId: "bootstrap",
        requestedCursor: null,
        page: makePage(initialItems),
      },
    ] as unknown as SharedContentEvent[]);
  }
  return applySharedContentEvents(state, vector.events.map(materializeEvent));
}

test("request sequencing vectors replay complete state projections strictly", () => {
  const projectionKeys: Set<string> = new Set(completeStateProjectionKeys);
  for (const vector of vectors.requestSequencing.cases) {
    const unexpectedKeys = Object.keys(vector.expected).filter((key) => !projectionKeys.has(key));
    assert.deepEqual(unexpectedKeys, [], `${vector.name}: unhandled projection keys`);
    assert.deepEqual(Object.keys(vector.expected).sort(), [...completeStateProjectionKeys].sort(), vector.name);
    const { itemIds: _itemIds, ...completeProjection } = stateProjection(
      replayRequestSequencingCase(vector),
    );
    assert.deepEqual(completeProjection, vector.expected, vector.name);
  }
});

test("runtime events without an identity generation fail closed", () => {
  const state = createSharedContentState("owner-a", "conversation-a", 7);
  const missingGeneration = {
    type: "galleryStatusChanged",
    identityId: "owner-a",
    conversationId: "conversation-a",
    status: "content",
  } as unknown as SharedContentEvent;

  assert.strictEqual(reduceSharedContentState(state, missingGeneration), state);
});
