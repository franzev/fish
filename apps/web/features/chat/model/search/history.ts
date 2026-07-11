import type { ChatFilterCriterion } from "./types";

const storageKey = "fish.chat-search-history.v1";
const historyLimit = 8;
const contentKinds = new Set(["image", "video", "link", "file", "embed"]);
const authorTypes = new Set(["client", "coach"]);
const dateOperators = new Set(["before", "after", "during"]);

export interface ChatSearchHistoryEntry {
  id: string;
  query: string;
  criteria: ChatFilterCriterion[];
  savedAt: string;
}

function entryId(query: string, criteria: ChatFilterCriterion[]): string {
  return JSON.stringify({
    query: query.trim().toLocaleLowerCase(),
    criteria: criteria.map((criterion) => criterion.id).sort(),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCriterion(value: unknown): value is ChatFilterCriterion {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.kind !== "string") return false;
  if (value.kind === "from" || value.kind === "mentions") {
    return isRecord(value.member) && typeof value.member.id === "string" && typeof value.member.displayName === "string" && typeof value.member.username === "string";
  }
  if (value.kind === "in") {
    return isRecord(value.channel) && typeof value.channel.id === "string" && typeof value.channel.name === "string" && typeof value.channel.slug === "string" && typeof value.channel.conversationId === "string";
  }
  if (value.kind === "has") return typeof value.contentKind === "string" && contentKinds.has(value.contentKind);
  if (value.kind === "author") return typeof value.authorType === "string" && authorTypes.has(value.authorType);
  if (value.kind === "pinned") return typeof value.value === "boolean";
  if (value.kind === "date") return typeof value.operator === "string" && dateOperators.has(value.operator) && typeof value.date === "string";
  return false;
}

export function readChatSearchHistory(): ChatSearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is ChatSearchHistoryEntry =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as ChatSearchHistoryEntry).id === "string" &&
          typeof (entry as ChatSearchHistoryEntry).query === "string" &&
          Array.isArray((entry as ChatSearchHistoryEntry).criteria) &&
          (entry as ChatSearchHistoryEntry).criteria.every(isCriterion) &&
          typeof (entry as ChatSearchHistoryEntry).savedAt === "string"
      )
      .slice(0, historyLimit);
  } catch {
    return [];
  }
}

export function addChatSearchHistory(
  query: string,
  criteria: ChatFilterCriterion[]
): ChatSearchHistoryEntry[] {
  const nextEntry: ChatSearchHistoryEntry = {
    id: entryId(query, criteria),
    query: query.trim(),
    criteria,
    savedAt: new Date().toISOString(),
  };
  const next = [
    nextEntry,
    ...readChatSearchHistory().filter((entry) => entry.id !== nextEntry.id),
  ].slice(0, historyLimit);
  try {
    if (typeof window.localStorage?.setItem === "function") {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  } catch {
    // Storage can be unavailable in private/restricted browsing. Search still works.
  }
  return next;
}

export function clearChatSearchHistory(): void {
  if (typeof window !== "undefined") {
    try {
      if (typeof window.localStorage?.removeItem === "function") {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Clearing an unavailable history store is already the desired result.
    }
  }
}
