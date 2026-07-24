import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import * as sharedContentOrdering from "./ordering.ts";
import type {
  SharedContentCategory,
  SharedContentItem,
} from "./types.ts";

type GalleryFixtureItem = SharedContentItem & {
  durationMs?: number;
};

interface GalleryProjectionExpected {
  categories: SharedContentCategory[];
  selectedCategory: SharedContentCategory | null;
  showCategoryControl: boolean;
  itemIdsByCategory: Partial<Record<SharedContentCategory, string[]>>;
  authoritativeEmpty?: boolean;
  visibleAnchorItemId?: string;
  requestState?: string;
}

interface GalleryProjectionCase {
  name: string;
  kind:
    | "projection"
    | "earlierAccepted"
    | "earlierIntent"
    | "earlierFailure"
    | "duration"
    | "paging";
  input: Record<string, unknown>;
  expected: Record<string, unknown> | GalleryProjectionExpected;
}

interface GalleryProjection {
  categories: SharedContentCategory[];
  selectedCategory: SharedContentCategory | null;
  showCategoryControl: boolean;
  itemsByCategory: Partial<Record<SharedContentCategory, SharedContentItem[]>>;
}

interface SharedContentVectors {
  metadata: {
    expectedCaseCount: number;
    expectedPhase13CaseCount: number;
    expectedPortableCaseCount: number;
    phase13Groups: string[];
  };
  items: Record<string, GalleryFixtureItem>;
  galleryStates: {
    cases: Array<{ name: string; status: string }>;
    galleryProjection: {
      cases: GalleryProjectionCase[];
    };
  };
}

const fixturePath = new URL("./fixtures/shared-content-vectors.json", import.meta.url);
const vectors = JSON.parse(readFileSync(fixturePath, "utf8")) as SharedContentVectors;
const projectionCases = vectors.galleryStates.galleryProjection.cases;
const categoryOrder = ["media", "files", "links", "voice"] as const;

async function loadSharedContentNamespace(): Promise<Record<string, unknown>> {
  const galleryUrl = new URL("./gallery.ts", import.meta.url);
  const gallerySpecifier = galleryUrl.href;
  return {
    ...sharedContentOrdering,
    ...(existsSync(galleryUrl)
      ? await import(gallerySpecifier)
      : {}),
  };
}

function requireProjectSharedContentGallery(
  productionNamespace: Record<string, unknown>,
): (
  items: readonly SharedContentItem[],
  selectedCategory: SharedContentCategory | null,
) => GalleryProjection {
  const implementation = productionNamespace["projectSharedContentGallery"];
  assert.equal(
    typeof implementation,
    "function",
    "missing Phase 13 export: projectSharedContentGallery",
  );
  return implementation as (
    items: readonly SharedContentItem[],
    selectedCategory: SharedContentCategory | null,
  ) => GalleryProjection;
}

function requireItems(itemIds: unknown): GalleryFixtureItem[] {
  assert.ok(Array.isArray(itemIds), "fixture itemIds must be an array");
  return itemIds.map((itemId) => {
    assert.equal(typeof itemId, "string", "fixture itemId must be a string");
    const item = vectors.items[itemId];
    if (item === undefined) {
      throw new Error(`Unknown shared-content gallery fixture item: ${itemId}`);
    }
    return item;
  });
}

function selectedCategory(input: Record<string, unknown>): SharedContentCategory | null {
  const value = input.selectedCategory;
  if (value === null) return null;
  assert.equal(
    categoryOrder.includes(value as SharedContentCategory),
    true,
    `invalid selectedCategory: ${String(value)}`,
  );
  return value as SharedContentCategory;
}

function projectionSnapshot(projection: GalleryProjection): GalleryProjectionExpected {
  const itemIdsByCategory = Object.fromEntries(
    projection.categories.map((category) => [
      category,
      (projection.itemsByCategory[category] ?? []).map((item) => item.itemId),
    ]),
  ) as Partial<Record<SharedContentCategory, string[]>>;
  return {
    categories: projection.categories,
    selectedCategory: projection.selectedCategory,
    showCategoryControl: projection.showCategoryControl,
    itemIdsByCategory,
  };
}

test("Phase 13 fixture metadata accounts for the portable gallery group exactly", () => {
  assert.deepEqual(vectors.metadata.phase13Groups, ["galleryProjection"]);
  assert.equal(projectionCases.length, vectors.metadata.expectedPhase13CaseCount);
  assert.equal(
    vectors.metadata.expectedCaseCount + projectionCases.length,
    vectors.metadata.expectedPortableCaseCount,
  );
  assert.equal(vectors.metadata.expectedPhase13CaseCount, 16);
  assert.equal(vectors.metadata.expectedPortableCaseCount, 108);
  assert.equal(
    new Set(projectionCases.map((vector) => vector.name)).size,
    projectionCases.length,
    "gallery projection case names must be unique",
  );
});

test("Phase 13 category order export is present and exact", async () => {
  const productionNamespace = await loadSharedContentNamespace();
  const productionOrder = productionNamespace["SHARED_CONTENT_CATEGORY_ORDER"];
  assert.ok(
    Array.isArray(productionOrder),
    "missing Phase 13 export: SHARED_CONTENT_CATEGORY_ORDER",
  );
  assert.deepEqual(productionOrder, categoryOrder);
  assert.equal(Object.isFrozen(productionOrder), true);
});

test("Phase 13 safe item contract declares nullable durationMs metadata", () => {
  const typesSource = readFileSync(new URL("./types.ts", import.meta.url), "utf8");
  assert.equal(
    /\bdurationMs\??:\s*number\b/.test(typesSource),
    true,
    "missing Phase 13 SharedContentItem contract: durationMs",
  );
});

test("gallery projection vectors define loading, empty, category, and selection behavior", async () => {
  const productionNamespace = await loadSharedContentNamespace();
  const project = requireProjectSharedContentGallery(productionNamespace);
  for (const vector of projectionCases.filter(({ kind }) => kind === "projection")) {
    const projection = project(
      requireItems(vector.input.itemIds),
      selectedCategory(vector.input),
    );
    const actual = projectionSnapshot(projection);
    const expected = vector.expected as unknown as GalleryProjectionExpected;
    assert.deepEqual(
      actual,
      {
        categories: expected.categories,
        selectedCategory: expected.selectedCategory,
        showCategoryControl: expected.showCategoryControl,
        itemIdsByCategory: expected.itemIdsByCategory,
      },
      vector.name,
    );
    if (vector.input.authority !== undefined) {
      assert.equal(
        expected.authoritativeEmpty,
        vector.input.authority === "authoritative",
        vector.name,
      );
    }
  }
});

test("accepted global earlier pages add categories without switching or moving the anchor", async () => {
  const productionNamespace = await loadSharedContentNamespace();
  const project = requireProjectSharedContentGallery(productionNamespace);
  const vector = projectionCases.find(
    ({ kind }) => kind === "earlierAccepted",
  );
  assert.ok(vector, "missing earlierAccepted vector");
  const input = vector.input;
  const expected = vector.expected as unknown as GalleryProjectionExpected;
  const projection = project(
    [
      ...requireItems(input.beforeItemIds),
      ...requireItems(input.appendedItemIds),
    ],
    selectedCategory(input),
  );
  assert.deepEqual(
    {
      ...projectionSnapshot(projection),
      visibleAnchorItemId: input.visibleAnchorItemId,
      requestState: "ready",
    },
    expected,
    vector.name,
  );
});

test("earlier intent and failure vectors preserve bounded session state", () => {
  const duplicate = projectionCases.find(
    ({ kind }) => kind === "earlierIntent",
  );
  const failure = projectionCases.find(
    ({ kind }) => kind === "earlierFailure",
  );
  assert.ok(duplicate, "missing earlierIntent vector");
  assert.ok(failure, "missing earlierFailure vector");

  assert.equal(duplicate.input.requestState, "loading", duplicate.name);
  assert.equal(duplicate.input.intentCount, 2, duplicate.name);
  assert.deepEqual(duplicate.expected, {
    acceptedIntentCount: 0,
    requestCount: 1,
    selectedCategory: duplicate.input.selectedCategory,
    visibleAnchorItemId: duplicate.input.visibleAnchorItemId,
    requestState: "loading",
  });

  assert.deepEqual(failure.expected, {
    itemIds: requireItems(failure.input.itemIds).map((item) => item.itemId),
    selectedCategory: failure.input.selectedCategory,
    visibleAnchorItemId: failure.input.visibleAnchorItemId,
    requestState: "failed",
    message: "Earlier content didn't load. Try again.",
  });
});

test("voice duration vectors preserve null, zero, trusted, and invalid metadata", async () => {
  const productionNamespace = await loadSharedContentNamespace();
  const project = requireProjectSharedContentGallery(productionNamespace);
  for (const vector of projectionCases.filter(({ kind }) => kind === "duration")) {
    const [item] = requireItems([vector.input.itemId]);
    const expected = vector.expected as Record<string, unknown>;
    if (expected.accepted === false) {
      assert.throws(
        () => project([item], "voice"),
        {
          name: "RangeError",
          message: expected.error,
        },
        vector.name,
      );
      continue;
    }

    const projection = project([item], "voice");
    const [projected] = projection.itemsByCategory.voice ?? [];
    assert.ok(projected, vector.name);
    const durationMs = (projected as GalleryFixtureItem).durationMs ?? null;
    assert.equal(durationMs, expected.durationMs, vector.name);
    if (durationMs === null) {
      assert.equal(expected.label, "Duration unavailable", vector.name);
    }
  }
});

test("global earlier paging retains 40 rows and never renders the sentinel", () => {
  const vector = projectionCases.find(({ kind }) => kind === "paging");
  assert.ok(vector, "missing paging vector");
  const rows = requireItems(vector.input.rowIds);
  const pageFromRows = (
    sharedContentOrdering as unknown as Record<string, unknown>
  )["pageFromRows"];
  assert.equal(typeof pageFromRows, "function");
  const page = (
    pageFromRows as (
      rows: SharedContentItem[],
      pageSize: number,
    ) => {
      items: SharedContentItem[];
      hasMore: boolean;
      nextCursor: { itemId: string } | null;
    }
  )(rows, Number(vector.input.pageSize));
  const expected = vector.expected as Record<string, unknown>;
  assert.deepEqual(
    {
      retainedCount: page.items.length,
      hasMore: page.hasMore,
      lastRetainedItemId: page.items.at(-1)?.itemId,
      sentinelItemId: rows.at(40)?.itemId,
      sentinelRendered: page.items.some((item) => item.itemId === rows.at(40)?.itemId),
      cursorItemId: page.nextCursor?.itemId,
    },
    expected,
    vector.name,
  );
});
