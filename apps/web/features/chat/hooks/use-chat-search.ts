import type { ClientChatData } from "@/lib/services";
import type { ChatSearchActionState } from "@/features/chat/contracts";
import type { LocalMessage } from "./use-chat-messages";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChatSearchUrl,
  createSearchRequest,
  criteriaFromQuery,
  parseChatSearchQuery,
  readChatSearchUrlState,
  type ChatFilterCriterion,
} from "@/features/chat/model/search";
import { toLocalMessage } from "./use-chat-messages";
import { useLatestRequest } from "./use-latest-request";

export const searchPageSize = 25;
export type ChatRightSidebar = "members" | "search" | null;

const emptySearchMembers: NonNullable<ClientChatData["searchMembers"]> = [];
const emptySearchChannels: NonNullable<ClientChatData["searchChannels"]> = [];

interface UseChatSearchOptions {
  conversationId: string;
  presentation: "full" | "embedded";
  searchEnabled: boolean;
  searchMembers: NonNullable<ClientChatData["searchMembers"]>;
  searchChannels: NonNullable<ClientChatData["searchChannels"]>;
  searchMessagesAction?: (input: unknown) => Promise<ChatSearchActionState>;
  closeDetails: () => void;
  setRightSidebar: (sidebar: ChatRightSidebar) => void;
}

export function useChatSearch({
  conversationId,
  presentation,
  searchEnabled,
  searchMembers = emptySearchMembers,
  searchChannels = emptySearchChannels,
  searchMessagesAction,
  closeDetails,
  setRightSidebar,
}: UseChatSearchOptions) {
  const [search, setSearch] = useState("");
  const [searchCriteria, setSearchCriteria] = useState<ChatFilterCriterion[]>([]);
  const [committedSearch, setCommittedSearch] = useState("");
  const [committedSearchCriteria, setCommittedSearchCriteria] = useState<ChatFilterCriterion[]>([]);
  const [searchResults, setSearchResults] = useState<LocalMessage[]>([]);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchSort, setSearchSort] = useState<"asc" | "desc">("desc");
  const [isSearching, setIsSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const restoredUrlRef = useRef<string | null>(null);
  const { begin, isLatest, invalidate } = useLatestRequest(conversationId);

  const updateSearchUrl = useCallback((
    query: string,
    page: number,
    sortDirection: "asc" | "desc",
    mode: "push" | "replace"
  ) => {
    const nextUrl = createChatSearchUrl(window.location.href, {
      query,
      page,
      sortDirection,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history[mode === "push" ? "pushState" : "replaceState"](null, "", nextUrl);
    }
    restoredUrlRef.current = window.location.href;
  }, []);

  const invalidateSearch = useCallback(() => {
    invalidate();
    setIsSearching(false);
  }, [invalidate]);

  const clearSearchUrl = useCallback(() => {
    const nextUrl = createChatSearchUrl(window.location.href, null);
    window.history.replaceState(null, "", nextUrl);
    restoredUrlRef.current = window.location.href;
  }, []);

  const runSearch = useCallback(async (
    query: string,
    criteria: ChatFilterCriterion[],
    page = 1,
    sortDirection: "asc" | "desc" = "desc",
    navigationMode: "push" | "replace" | null = "push"
  ) => {
    const request = begin();
    setCommittedSearch(query);
    setCommittedSearchCriteria(criteria);
    closeDetails();
    setRightSidebar("search");
    setIsSearching(true);
    setSearchNotice(null);
    if (navigationMode) updateSearchUrl(query, page, sortDirection, navigationMode);
    if (!searchMessagesAction) {
      setIsSearching(false);
      setSearchNotice("Search is not available yet. Try again.");
      return;
    }

    try {
      let resolvedPage = page;
      let result = await searchMessagesAction(
        createSearchRequest(conversationId, query, criteria, page, sortDirection)
      );
      if (!isLatest(request)) return;
      if (result.status === "sent") {
        const totalCount = result.totalCount ?? 0;
        const lastPage = Math.max(1, Math.ceil(totalCount / searchPageSize));
        if (page > lastPage) {
          resolvedPage = lastPage;
          result = await searchMessagesAction(
            createSearchRequest(conversationId, query, criteria, lastPage, sortDirection)
          );
          if (!isLatest(request)) return;
          updateSearchUrl(query, lastPage, sortDirection, "replace");
        }
        setSearchResults((result.messages ?? []).map(toLocalMessage));
        setSearchTotalCount(result.totalCount ?? 0);
        setSearchPage(resolvedPage);
        setSearchSort(sortDirection);
      } else {
        setSearchResults([]);
        setSearchTotalCount(0);
        setSearchNotice(result.notice ?? "Search is not available yet. Try again.");
      }
    } catch {
      if (!isLatest(request)) return;
      setSearchResults([]);
      setSearchTotalCount(0);
      setSearchNotice("Search is not available yet. Try again.");
    } finally {
      if (isLatest(request)) setIsSearching(false);
    }
  }, [begin, closeDetails, conversationId, isLatest, searchMessagesAction, setRightSidebar, updateSearchUrl]);

  const runSearchRef = useRef(runSearch);
  useEffect(() => {
    runSearchRef.current = runSearch;
  }, [runSearch]);

  const submitSearch = useCallback((query: string, criteria: ChatFilterCriterion[]) => {
    void runSearchRef.current(query, criteria, 1, searchSort);
  }, [searchSort]);

  useEffect(() => {
    if (presentation === "embedded" || !searchEnabled) return;

    const restoreSearchFromUrl = () => {
      if (restoredUrlRef.current === window.location.href) return;
      restoredUrlRef.current = window.location.href;
      const urlState = readChatSearchUrlState(window.location.search);
      if (!urlState) {
        if (new URLSearchParams(window.location.search).has("search")) {
          clearSearchUrl();
        }
        invalidateSearch();
        setSearch("");
        setSearchCriteria([]);
        setCommittedSearch("");
        setCommittedSearchCriteria([]);
        setRightSidebar(null);
        return;
      }

      const criteria = criteriaFromQuery(urlState.query, searchMembers, searchChannels);
      const text = parseChatSearchQuery(urlState.query).text;
      if (!text && criteria.length === 0) {
        clearSearchUrl();
        return;
      }

      setSearch(urlState.query);
      setSearchCriteria(criteria);
      void runSearchRef.current(
        urlState.query,
        criteria,
        urlState.page,
        urlState.sortDirection,
        null
      );
    };

    restoreSearchFromUrl();
    window.addEventListener("popstate", restoreSearchFromUrl);
    return () => window.removeEventListener("popstate", restoreSearchFromUrl);
  }, [clearSearchUrl, invalidateSearch, presentation, searchChannels, searchEnabled, searchMembers, setRightSidebar]);

  return {
    search,
    setSearch,
    searchCriteria,
    setSearchCriteria,
    committedSearch,
    committedSearchCriteria,
    searchResults,
    searchTotalCount,
    searchPage,
    searchSort,
    setSearchSort,
    isSearching,
    searchNotice,
    runSearch,
    invalidateSearch,
    clearSearchUrl,
    submitSearch,
  };
}
