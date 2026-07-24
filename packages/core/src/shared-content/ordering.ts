import type {
  SharedContentCursor,
  SharedContentItem,
  SharedContentPage,
} from "./types.ts";

function compareDescending(left: string | number, right: string | number): number {
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

function compareCodepointsDescending(left: string, right: string): number {
  const leftCodepoints = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const rightCodepoints = Array.from(right, (character) => character.codePointAt(0) ?? 0);
  const length = Math.min(leftCodepoints.length, rightCodepoints.length);

  for (let index = 0; index < length; index += 1) {
    if (leftCodepoints[index] !== rightCodepoints[index]) {
      return leftCodepoints[index] > rightCodepoints[index] ? -1 : 1;
    }
  }

  return compareDescending(leftCodepoints.length, rightCodepoints.length);
}

export function compareSharedContentItems(
  left: SharedContentItem,
  right: SharedContentItem,
): number {
  return (
    compareDescending(left.sourceCreatedAt, right.sourceCreatedAt) ||
    compareDescending(left.sourceMessageId, right.sourceMessageId) ||
    compareDescending(left.sourceRank, right.sourceRank) ||
    compareCodepointsDescending(left.itemId, right.itemId)
  );
}

function cursorFromItem(item: SharedContentItem): SharedContentCursor {
  return {
    sourceCreatedAt: item.sourceCreatedAt,
    sourceMessageId: item.sourceMessageId,
    sourceRank: item.sourceRank,
    itemId: item.itemId,
  };
}

export function pageFromRows(
  rows: SharedContentItem[],
  pageSize = 40,
): SharedContentPage {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 40) {
    throw new RangeError("pageSize must be an integer between 1 and 40");
  }

  const retained: SharedContentItem[] = [];
  const seenItemIds = new Set<string>();

  // The incoming sequence is already server-ordered. The extra row is only a
  // sentinel; it is never promoted, rendered, cached, or used as the cursor.
  for (const row of rows.slice(0, pageSize)) {
    if (seenItemIds.has(row.itemId)) continue;
    seenItemIds.add(row.itemId);
    retained.push(row);
  }

  return {
    items: retained,
    hasMore: rows.length > pageSize,
    nextCursor: retained.length > 0 ? cursorFromItem(retained[retained.length - 1]) : null,
  };
}
