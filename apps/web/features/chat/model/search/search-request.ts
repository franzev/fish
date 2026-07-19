import type { ChatSearchInput } from "@/lib/services";
import { parseChatSearchQuery } from "./query";
import type { ChatFilterCriterion } from "./types";

const defaultPageSize = 25;

export interface SearchRequestOptions {
  pageSize?: number;
  timeZone?: string;
}

export function createSearchRequest(
  conversationId: string,
  query: string,
  criteria: ChatFilterCriterion[],
  page: number,
  sortDirection: "asc" | "desc",
  options: SearchRequestOptions = {}
): ChatSearchInput {
  const pageSize = options.pageSize ?? defaultPageSize;
  const timeZone =
    options.timeZone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC";

  return {
    conversationId,
    text: parseChatSearchQuery(query).text,
    senderIds: criteria.flatMap((item) =>
      item.kind === "from" ? [item.member.id] : []
    ),
    mentionedUserIds: criteria.flatMap((item) =>
      item.kind === "mentions" ? [item.member.id] : []
    ),
    channelIds: criteria.flatMap((item) =>
      item.kind === "in" ? [item.channel.id] : []
    ),
    contentKinds: criteria.flatMap((item) =>
      item.kind === "has" ? [item.contentKind] : []
    ),
    authorTypes: criteria.flatMap((item) =>
      item.kind === "author" ? [item.authorType] : []
    ),
    pinned:
      criteria.find(
        (item): item is Extract<ChatFilterCriterion, { kind: "pinned" }> =>
          item.kind === "pinned"
      )?.value ?? null,
    dates: criteria.flatMap((item) =>
      item.kind === "date"
        ? [{ operator: item.operator, date: item.date, timeZone }]
        : []
    ),
    cursor: null,
    offset: (Math.max(page, 1) - 1) * pageSize,
    sortDirection,
    limit: pageSize,
  };
}
