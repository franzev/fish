import type {
  SharedContentCategory,
  SharedContentItem,
  SharedContentKind,
} from "./types.ts";

export const SHARED_CONTENT_CATEGORY_ORDER: readonly SharedContentCategory[] =
  Object.freeze(["media", "files", "links", "voice"]);

export interface SharedContentGalleryProjection {
  categories: SharedContentCategory[];
  selectedCategory: SharedContentCategory | null;
  showCategoryControl: boolean;
  itemsByCategory: Partial<
    Record<SharedContentCategory, SharedContentItem[]>
  >;
}

const DISPLAY_KINDS_BY_CATEGORY: Readonly<
  Record<SharedContentCategory, ReadonlySet<SharedContentKind>>
> = {
  media: new Set(["photo", "video", "gif", "sticker"]),
  files: new Set(["document"]),
  links: new Set(["link"]),
  voice: new Set(["voice"]),
};

function isDisplayEligible(item: SharedContentItem): boolean {
  return DISPLAY_KINDS_BY_CATEGORY[item.category]?.has(item.kind) === true;
}

function validateDuration(item: SharedContentItem): void {
  if (
    item.durationMs !== undefined &&
    (!Number.isInteger(item.durationMs) || item.durationMs < 0)
  ) {
    throw new RangeError("durationMs must be a non-negative integer");
  }
}

/**
 * Project accepted conversation-owned items into the canonical gallery
 * session shape. Authority, ordering, and pagination remain upstream.
 */
export function projectSharedContentGallery(
  items: readonly SharedContentItem[],
  selectedCategory: SharedContentCategory | null,
): SharedContentGalleryProjection {
  const grouped = new Map<
    SharedContentCategory,
    SharedContentItem[]
  >(
    SHARED_CONTENT_CATEGORY_ORDER.map((category) => [category, []]),
  );

  for (const item of items) {
    validateDuration(item);
    if (!isDisplayEligible(item)) continue;
    grouped.get(item.category)?.push(item);
  }

  const categories = SHARED_CONTENT_CATEGORY_ORDER.filter(
    (category) => (grouped.get(category)?.length ?? 0) > 0,
  );
  const itemsByCategory = Object.fromEntries(
    categories.map((category) => [category, grouped.get(category)]),
  ) as Partial<Record<SharedContentCategory, SharedContentItem[]>>;
  const retainedSelection =
    selectedCategory !== null && categories.includes(selectedCategory);

  return {
    categories,
    selectedCategory: retainedSelection
      ? selectedCategory
      : (categories[0] ?? null),
    showCategoryControl: categories.length > 1,
    itemsByCategory,
  };
}
