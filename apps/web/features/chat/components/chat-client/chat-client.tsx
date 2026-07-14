"use client";

import type {
  ChatSearchInput,
  ClientChatData,
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import { useTimeFormatPreference } from "@/lib/prefs/time-format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatSearchActionState,
  ReportGifActionState,
  SendMessageActionState,
} from "@/features/chat/contracts";
import {
  createChatSearchUrl,
  criteriaFromQuery,
  parseChatSearchQuery,
  readChatSearchUrlState,
  type ChatFilterCriterion,
} from "@/features/chat/model/search";
import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";
import { useChatImageUploads } from "@/features/chat/hooks/use-chat-image-uploads";
import type {
  LoadOlderMessagesActionState,
  LocalMessage,
} from "@/features/chat/hooks/use-chat-messages";
import {
  toLocalMessage,
  useChatMessages,
} from "@/features/chat/hooks/use-chat-messages";
import { useChatPresence } from "@/features/chat/hooks/use-chat-presence";
import { useChatReadState } from "@/features/chat/hooks/use-chat-read-state";
import { useChatRealtime } from "@/features/chat/hooks/use-chat-realtime";
import { useLoadOlderMessages } from "@/features/chat/hooks/use-load-older-messages";
import { useStickToBottom } from "@/features/chat/hooks/use-stick-to-bottom";
import { useChatStore } from "@/features/chat/model/store";
import { ChatHeader } from "../chat-header";
import { ChatComposerSurface } from "../chat-composer-surface";
import { ChatMessageList } from "../chat-message-list";
import { FiltersDialog } from "../search-filters";
import { SearchResultsSidebar } from "../search-results";
import {
  selectRealtimeStatusForConversation,
} from "@/features/chat/model/store";

const searchPageSize = 25;
const emptySearchMembers: NonNullable<ClientChatData["searchMembers"]> = [];
const emptySearchChannels: NonNullable<ClientChatData["searchChannels"]> = [];

type SearchNavigationMode = "push" | "replace" | null;

function createSearchRequest(
  conversationId: string,
  query: string,
  criteria: ChatFilterCriterion[],
  page: number,
  sortDirection: "asc" | "desc"
): ChatSearchInput {
  return {
    conversationId,
    text: parseChatSearchQuery(query).text,
    senderIds: criteria.flatMap((item) => item.kind === "from" ? [item.member.id] : []),
    mentionedUserIds: criteria.flatMap((item) => item.kind === "mentions" ? [item.member.id] : []),
    channelIds: criteria.flatMap((item) => item.kind === "in" ? [item.channel.id] : []),
    contentKinds: criteria.flatMap((item) => item.kind === "has" ? [item.contentKind] : []),
    authorTypes: criteria.flatMap((item) => item.kind === "author" ? [item.authorType] : []),
    pinned: criteria.find((item): item is Extract<ChatFilterCriterion, { kind: "pinned" }> => item.kind === "pinned")?.value ?? null,
    dates: criteria.flatMap((item) => item.kind === "date" ? [{ operator: item.operator, date: item.date, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }] : []),
    cursor: null,
    offset: (page - 1) * searchPageSize,
    sortDirection,
    limit: searchPageSize,
  };
}

export interface ChatClientProps {
  chat: ClientChatData;
  focusMessageId?: string | null;
  /** Presentation gate only; the Friends backend remains authoritative. */
  friendActionsEnabled?: boolean;
  sendMessageAction: (input: unknown) => Promise<SendMessageActionState>;
  searchMessagesAction?: (input: unknown) => Promise<ChatSearchActionState>;
  editMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  deleteMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  toggleReactionAction?: (input: unknown) => Promise<SendMessageActionState>;
  reportGifAction?: (input: unknown) => Promise<ReportGifActionState>;
  markReadStateAction?: (input: unknown) => Promise<{
    status: "sent" | "notice";
    values: unknown;
    notice?: string;
    readState?: ClientChatReadState;
  }>;
  refreshMessagesAction?: (input: unknown) => Promise<{
    status: "sent" | "notice";
    values: unknown;
    notice?: string;
    messages?: ClientChatMessage[];
  }>;
  refreshConversationAction?: (input: unknown) => Promise<{
    status: "sent" | "notice";
    values: unknown;
    notice?: string;
    messages?: ClientChatMessage[];
    readStates?: ClientChatReadState[];
  }>;
  loadOlderMessagesAction?: (input: unknown) => Promise<LoadOlderMessagesActionState>;
  backfillMessagesAction?: (input: unknown) => Promise<LoadOlderMessagesActionState>;
  loadNewestMessagesAction?: (input: unknown) => Promise<LoadOlderMessagesActionState>;
}

export function ChatClient({
  chat,
  focusMessageId,
  friendActionsEnabled = false,
  sendMessageAction,
  searchMessagesAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
  reportGifAction,
  markReadStateAction,
  refreshMessagesAction,
  refreshConversationAction,
  loadOlderMessagesAction,
  backfillMessagesAction,
  loadNewestMessagesAction,
}: ChatClientProps) {
  const realtimeStatus = useChatStore((state) =>
    selectRealtimeStatusForConversation(state, chat.conversationId)
  );
  const {
    messages,
    setMessages,
    refreshMessages,
    refreshConversation,
    applyGapBackfill,
    loadOlderMessages,
    hasMoreOlder,
    isLoadingOlder,
    hasLoadError,
  } = useChatMessages({
    chat,
    refreshMessagesAction,
    refreshConversationAction,
    loadOlderMessagesAction,
    backfillMessagesAction,
    loadNewestMessagesAction,
  });
  const { mergeReadState, participantReadState } = useChatReadState({
    chat,
    messages,
    markReadStateAction,
  });
  const [search, setSearch] = useState("");
  const [searchCriteria, setSearchCriteria] = useState<ChatFilterCriterion[]>([]);
  const [committedSearch, setCommittedSearch] = useState("");
  const [committedSearchCriteria, setCommittedSearchCriteria] = useState<ChatFilterCriterion[]>([]);
  const [searchResults, setSearchResults] = useState<LocalMessage[]>([]);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchSort, setSearchSort] = useState<"asc" | "desc">("desc");
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const searchSequenceRef = useRef(0);
  const restoredUrlRef = useRef<string | null>(null);
  const searchMembers = chat.searchMembers ?? emptySearchMembers;
  const searchChannels = chat.searchChannels ?? emptySearchChannels;
  const timeFormatPref = useTimeFormatPreference();
  const isCommunity = chat.kind === "community";
  const chatTitle = chat.title ?? chat.participant.displayName;
  const activityName = isCommunity ? "Someone" : chat.participant.displayName;
  const getMessageAuthorName = (message: ClientChatMessage) =>
    message.senderDisplayName ?? (isCommunity ? "Member" : chat.participant.displayName);
  const getMessageAuthorAvatar = (message: ClientChatMessage) =>
    message.senderAvatarUrl
    ?? searchMembers.find((member) => member.id === message.senderId)?.avatarUrl
    ?? (!isCommunity && message.senderId === chat.participant.id
      ? chat.participant.avatarUrl
      : undefined);
  const getMessageAuthorMember = (message: ClientChatMessage) => {
    const directoryMember = searchMembers.find(
      (member) => member.id === message.senderId
    );
    return {
      id: message.senderId,
      displayName: getMessageAuthorName(message),
      username: directoryMember?.username,
      role: message.senderRole,
      avatarUrl: getMessageAuthorAvatar(message),
    };
  };
  const {
    participantTyping,
    sendLocalTyping,
    stopLocalTyping,
    scheduleLocalTypingStop,
  } = useChatRealtime({
    chat,
    setMessages,
    mergeReadState,
    refreshMessages,
    refreshConversation,
    applyGapBackfill,
  });
  const { presenceStatus } = useChatPresence({ chat, timeFormatPref });
  // Full messages array (not filteredMessages): search filtering must never
  // trigger scroll behavior.
  const { viewportRef, showNewMessages, scrollToBottom } = useStickToBottom({
    messages,
    currentUserId: chat.currentUserId,
  });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedFocusMessageRef = useRef<string | null>(null);
  const { hasOlderLoadError, loadOlderAndPreserveScroll } = useLoadOlderMessages({
    viewportRef,
    sentinelRef,
    hasMoreOlder,
    isLoadingOlder,
    hasLoadError,
    onLoadOlder: loadOlderMessages,
  });
  useEffect(() => {
    if (!focusMessageId || messages.some((message) => message.id === focusMessageId)) {
      return;
    }
    if (requestedFocusMessageRef.current === focusMessageId) return;
    requestedFocusMessageRef.current = focusMessageId;
    void refreshMessages([focusMessageId]);
  }, [focusMessageId, messages, refreshMessages]);

  useEffect(() => {
    if (!focusMessageId || !messages.some((message) => message.id === focusMessageId)) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      document.getElementById(`message-${focusMessageId}`)?.scrollIntoView({
        block: "center",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusMessageId, messages]);
  // "Reconnecting…" is only calm/true once the conversation has genuinely
  // connected before — the very first mount also passes through
  // "connecting", and that ordinary initial load must never read as a
  // reconnect (states.md: reassure, never alarm). Derived during render (the
  // React-documented "adjusting state when a prop changes" pattern) rather
  // than an effect, so a setState-in-effect cascade never fires.
  const [previousConversationId, setPreviousConversationId] = useState(
    chat.conversationId
  );
  const [previousRealtimeStatus, setPreviousRealtimeStatus] = useState(realtimeStatus);
  const [hasConnected, setHasConnected] = useState(realtimeStatus === "connected");
  if (chat.conversationId !== previousConversationId) {
    // A mounted client switching conversations must start the new one from
    // a clean first-connect: hasConnected (and the previousRealtimeStatus
    // baseline it is compared against) are scoped to the conversation they
    // were observed in, or the old conversation's prior "connected" would
    // make the new one's ordinary first "connecting" read as a reconnect
    // (WR-06).
    setPreviousConversationId(chat.conversationId);
    setPreviousRealtimeStatus(realtimeStatus);
    setHasConnected(realtimeStatus === "connected");
  } else if (realtimeStatus !== previousRealtimeStatus) {
    setPreviousRealtimeStatus(realtimeStatus);
    if (realtimeStatus === "connected") {
      setHasConnected(true);
    }
  }
  const isReconnecting = realtimeStatus === "connecting" && hasConnected;
  const isOffline = realtimeStatus === "disconnected";
  const imageUploads = useChatImageUploads(chat.conversationId);
  const {
    draft,
    selectedGif,
    selectedStickerId,
    notice,
    canSend,
    replyingTo,
    editingMessage,
    handleDraftChange,
    handleSend,
    sendWithRequestId,
    handleDeleteMessage,
    handleToggleReaction,
    handleReportGif,
    startReplyingToMessage,
    startEditingMessage,
    cancelReply,
    cancelEdit,
    selectGif,
    removeSelectedGif,
    selectSticker,
    removeSelectedSticker,
    handleComposerKeyDown,
  } = useChatComposer({
    chat,
    messages,
    sendMessageAction,
    editMessageAction,
    deleteMessageAction,
    toggleReactionAction,
    reportGifAction,
    sendLocalTyping,
    stopLocalTyping,
    scheduleLocalTypingStop,
    pendingImages: imageUploads.images,
    // The sent row takes ownership of local image preview URLs so it can
    // render immediately without downloading its just-uploaded image again.
    clearPendingImages: () => imageUploads.clear({ preservePreviewUrls: true }),
  });

  // Room membership has no dedicated table yet (demo bridge), so the member
  // count is derived from everyone the room has already seen: read states,
  // message senders, and the current user.
  const memberCount = useMemo(() => {
    const memberIds = new Set<string>([chat.currentUserId]);
    for (const readState of chat.readStates ?? []) {
      memberIds.add(readState.userId);
    }
    for (const message of messages) {
      memberIds.add(message.senderId);
    }
    return memberIds.size;
  }, [chat.currentUserId, chat.readStates, messages]);
  const updateSearchUrl = useCallback((
    query: string,
    page: number,
    sortDirection: "asc" | "desc",
    mode: Exclude<SearchNavigationMode, null>
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

  const runSearch = useCallback(async (
    query: string,
    criteria: ChatFilterCriterion[],
    page = 1,
    sortDirection: "asc" | "desc" = "desc",
    navigationMode: SearchNavigationMode = "push"
  ) => {
    const sequence = ++searchSequenceRef.current;
    setCommittedSearch(query);
    setCommittedSearchCriteria(criteria);
    setSearchResultsOpen(true);
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
        createSearchRequest(chat.conversationId, query, criteria, page, sortDirection)
      );
      if (sequence !== searchSequenceRef.current) return;
      if (result.status === "sent") {
        const totalCount = result.totalCount ?? 0;
        const lastPage = Math.max(1, Math.ceil(totalCount / searchPageSize));
        if (page > lastPage) {
          resolvedPage = lastPage;
          result = await searchMessagesAction(
            createSearchRequest(chat.conversationId, query, criteria, lastPage, sortDirection)
          );
          if (sequence !== searchSequenceRef.current) return;
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
      if (sequence !== searchSequenceRef.current) return;
      setSearchResults([]);
      setSearchTotalCount(0);
      setSearchNotice("Search is not available yet. Try again.");
    } finally {
      if (sequence === searchSequenceRef.current) setIsSearching(false);
    }
  }, [chat.conversationId, searchMessagesAction, updateSearchUrl]);

  useEffect(() => {
    const restoreSearchFromUrl = () => {
      if (restoredUrlRef.current === window.location.href) return;
      restoredUrlRef.current = window.location.href;
      const urlState = readChatSearchUrlState(window.location.search);
      if (!urlState) {
        if (new URLSearchParams(window.location.search).has("search")) {
          const nextUrl = createChatSearchUrl(window.location.href, null);
          window.history.replaceState(null, "", nextUrl);
          restoredUrlRef.current = window.location.href;
        }
        searchSequenceRef.current += 1;
        setSearch("");
        setSearchCriteria([]);
        setCommittedSearch("");
        setCommittedSearchCriteria([]);
        setSearchResultsOpen(false);
        setIsSearching(false);
        return;
      }

      const criteria = criteriaFromQuery(urlState.query, searchMembers, searchChannels);
      const text = parseChatSearchQuery(urlState.query).text;
      if (!text && criteria.length === 0) {
        const nextUrl = createChatSearchUrl(window.location.href, null);
        window.history.replaceState(null, "", nextUrl);
        restoredUrlRef.current = window.location.href;
        return;
      }

      setSearch(urlState.query);
      setSearchCriteria(criteria);
      void runSearch(
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
  }, [runSearch, searchChannels, searchMembers]);
  const latestMineRequestId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.senderId === chat.currentUserId) {
        return message.clientRequestId;
      }
    }

    return null;
  }, [chat.currentUserId, messages]);

  return (
    <section
      className="flex min-h-0 w-full flex-1 flex-col"
      aria-label={isCommunity ? `${chatTitle} room` : `Conversation with ${chatTitle}`}
    >
      <ChatHeader
        chatTitle={chatTitle}
        participantId={chat.participant.id}
        avatarUrl={chat.participant.avatarUrl}
        channelName={chat.channelName}
        isCommunity={isCommunity}
        memberCount={memberCount}
        presenceLabel={presenceStatus.label}
        showOnlineDot={presenceStatus.showOnlineDot}
        search={search}
        onSearchChange={setSearch}
        criteria={searchCriteria}
        onCriteriaChange={setSearchCriteria}
        members={searchMembers}
        channels={searchChannels}
        onSearchSubmit={(query, criteria) => void runSearch(query, criteria, 1, searchSort)}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">

      <ChatMessageList
        viewport={{
          ref: viewportRef,
          showNewMessages,
          scrollToBottom,
          isReconnecting,
        }}
        pagination={{
          sentinelRef,
          hasMore: hasMoreOlder,
          hasError: hasOlderLoadError,
          loading: isLoadingOlder,
          load: loadOlderAndPreserveScroll,
        }}
        transcript={{
          visibleMessages: messages,
          allMessages: messages,
          participantTyping,
          isCommunity,
          activityName,
          chat,
          participantReadState,
          latestMineRequestId,
          friendActionsEnabled,
          focusMessageId,
          getAuthorName: getMessageAuthorName,
          getAuthorAvatar: getMessageAuthorAvatar,
          getAuthorMember: getMessageAuthorMember,
        }}
        actions={{
          reply: startReplyingToMessage,
          toggleReaction: handleToggleReaction,
          reportGif: handleReportGif,
          edit: startEditingMessage,
          delete: handleDeleteMessage,
          retry: sendWithRequestId,
        }}
      />

      <ChatComposerSurface
        chat={chat}
        isOffline={isOffline}
        notice={notice}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        draft={draft}
        canSend={canSend}
        getMessageAuthorName={getMessageAuthorName}
        cancelReply={cancelReply}
        cancelEdit={cancelEdit}
        handleDraftChange={handleDraftChange}
        handleSend={handleSend}
        handleComposerKeyDown={handleComposerKeyDown}
        stopLocalTyping={stopLocalTyping}
        scrollToBottom={scrollToBottom}
        images={imageUploads.images}
        imageNotice={imageUploads.notice}
        addImages={imageUploads.addFiles}
        removeImage={imageUploads.remove}
        retryImage={imageUploads.retry}
        selectedGif={selectedGif}
        selectGif={selectGif}
        removeSelectedGif={removeSelectedGif}
        selectedStickerId={selectedStickerId}
        selectSticker={selectSticker}
        removeSelectedSticker={removeSelectedSticker}
      />
      </div>
      {searchResultsOpen && <SearchResultsSidebar
        messages={searchResults}
        totalCount={searchTotalCount}
        page={searchPage}
        pageSize={searchPageSize}
        sortDirection={searchSort}
        filterCount={committedSearchCriteria.length}
        isSearching={isSearching}
        notice={searchNotice}
        currentUserId={chat.currentUserId}
        members={searchMembers}
        channels={searchChannels}
        onClose={() => {
          setSearchResultsOpen(false);
          const nextUrl = createChatSearchUrl(window.location.href, null);
          window.history.replaceState(null, "", nextUrl);
          restoredUrlRef.current = window.location.href;
        }}
        onOpenFilters={() => setFiltersOpen(true)}
        onSortChange={(direction) => void runSearch(committedSearch, committedSearchCriteria, 1, direction)}
        onPageChange={(page) => void runSearch(committedSearch, committedSearchCriteria, page, searchSort)}
      />}
      </div>
      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        query={search}
        criteria={searchCriteria}
        members={searchMembers}
        channels={searchChannels}
        onApply={(query, criteria) => {
          setSearch(query);
          setSearchCriteria(criteria);
          setFiltersOpen(false);
          void runSearch(query, criteria, 1, searchSort);
        }}
      />
    </section>
  );
}
