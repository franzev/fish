"use client";

import type { ClientChatData, ClientChatMessage, ClientChatReadState } from "@/lib/services";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ChatSearchActionState,
  ReportGifActionState,
  SendMessageActionState,
  UnreadSummaryActionState,
} from "@/features/chat/contracts";
import { resolveMessageAuthor, resolveMessageAuthorAvatar, resolveMessageAuthorName } from "@/features/chat/model/author-identity";
import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";
import { useChatImageUploads } from "@/features/chat/hooks/use-chat-image-uploads";
import type { LoadOlderMessagesActionState } from "@/features/chat/hooks/use-chat-messages";
import { useChatMessages } from "@/features/chat/hooks/use-chat-messages";
import { usePresence } from "@/features/presence";
import { useChatReadState } from "@/features/chat/hooks/use-chat-read-state";
import { useChatRealtime } from "@/features/chat/hooks/use-chat-realtime";
import { searchPageSize, useChatSearch } from "@/features/chat/hooks/use-chat-search";
import { useLoadOlderMessages } from "@/features/chat/hooks/use-load-older-messages";
import { useStickToBottom } from "@/features/chat/hooks/use-stick-to-bottom";
import { useChatStore } from "@/features/chat/model/store";
import { ChatHeader } from "../chat-header";
import { useConversationDetailsContext } from "../conversation-details-context";
import { ChatComposerSurface } from "../chat-composer-surface";
import { ChatMessageList } from "../chat-message-list";
import { MembersSidebar } from "../members-sidebar";
import { FiltersDialog } from "../search-filters";
import { SearchResultsSidebar } from "../search-results";
import { StickerPreloader } from "../sticker-preloader";
import {
  selectRealtimeStatusForConversation,
} from "@/features/chat/model/store";

const emptySearchMembers: NonNullable<ClientChatData["searchMembers"]> = [];
const emptySearchChannels: NonNullable<ClientChatData["searchChannels"]> = [];

type RightSidebar = "members" | "search" | null;

export interface ChatClientProps {
  chat: ClientChatData;
  focusMessageId?: string | null;
  presentation?: "full" | "embedded";
  /** Presentation gate only; the Friends backend remains authoritative. */
  friendActionsEnabled?: boolean;
  conversationActions?: ReactNode;
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
  refreshUnreadSummaryAction?: (
    input: unknown
  ) => Promise<UnreadSummaryActionState>;
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
  presentation = "full",
  friendActionsEnabled = false,
  conversationActions,
  sendMessageAction,
  searchMessagesAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
  reportGifAction,
  markReadStateAction,
  refreshUnreadSummaryAction,
  refreshMessagesAction,
  refreshConversationAction,
  loadOlderMessagesAction,
  backfillMessagesAction,
  loadNewestMessagesAction,
}: ChatClientProps) {
  const {
    available: detailsAvailable,
    open: detailsOpen,
    close: closeDetails,
    toggle: toggleDetails,
  } = useConversationDetailsContext();
  const realtimeStatus = useChatStore((state) =>
    selectRealtimeStatusForConversation(state, chat.conversationId)
  );
  const {
    messages,
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
  const {
    mergeReadState,
    participantReadState,
    unreadSummary,
    unreadBoundary,
    unreadPending,
    markUnreadMessagesRead,
  } = useChatReadState({
    chat,
    messages,
    markReadStateAction,
    refreshUnreadSummaryAction,
  });
  useEffect(() => {
    if (!markReadStateAction || unreadPending || unreadSummary.count <= 0) {
      return;
    }

    void markUnreadMessagesRead();
  }, [
    markReadStateAction,
    markUnreadMessagesRead,
    unreadPending,
    unreadSummary.count,
  ]);
  const [rightSidebar, setRightSidebar] = useState<RightSidebar>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchMembers = chat.searchMembers ?? emptySearchMembers;
  const searchChannels = chat.searchChannels ?? emptySearchChannels;
  // Older hydrated channel payloads predate `kind`, but still carry channel
  // identity. Treat either signal as authoritative so community controls do
  // not disappear while navigating between cached and current page data.
  const isCommunity = chat.kind === "community"
    || Boolean(chat.channelId ?? chat.channelSlug);
  const searchEnabled = isCommunity && Boolean(searchMessagesAction);
  const chatTitle = chat.title ?? chat.participant.displayName;
  const activityName = isCommunity ? "Someone" : chat.participant.displayName;
  const getMessageAuthorName = (message: ClientChatMessage) => resolveMessageAuthorName(message, chat);
  const getMessageAuthorAvatar = (message: ClientChatMessage) => resolveMessageAuthorAvatar(message, chat, searchMembers);
  const getMessageAuthorMember = (message: ClientChatMessage) => resolveMessageAuthor(message, chat, searchMembers);
  const searchState = useChatSearch({
    conversationId: chat.conversationId,
    presentation,
    searchEnabled,
    searchMembers,
    searchChannels,
    searchMessagesAction,
    closeDetails,
    setRightSidebar,
  });
  const {
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
    isSearching,
    searchNotice,
    runSearch,
    submitSearch,
    invalidateSearch,
    clearSearchUrl,
  } = searchState;
  const {
    participantTyping,
    sendLocalTyping,
    stopLocalTyping,
    scheduleLocalTypingStop,
  } = useChatRealtime({
    chat,
    mergeReadState,
    refreshMessages,
    refreshConversation,
    applyGapBackfill,
  });
  const participantPresence = usePresence(
    isCommunity ? undefined : chat.participant.id
  );
  // Full messages array (not filteredMessages): search filtering must never
  // trigger scroll behavior.
  const { viewportRef, showNewMessages, scrollToBottom } = useStickToBottom({
    messages,
    currentUserId: chat.currentUserId,
    suspendAutoScroll: Boolean(focusMessageId),
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
      document.getElementById(`message-${focusMessageId}`)?.scrollIntoView({
        block: "center",
        behavior: "auto",
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
    editDraft,
    editNotice,
    isSavingEdit,
    handleDraftChange,
    handleSend,
    sendWithRequestId,
    handleDeleteMessage,
    handleToggleReaction,
    handleReportGif,
    startReplyingToMessage,
    startEditingMessage,
    handleEditDraftChange,
    handleSaveEdit,
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
  // Legacy fixtures may omit the member directory. Keep their count useful by
  // deriving it from everyone the room has already seen.
  const observedMemberCount = useMemo(() => {
    const memberIds = new Set<string>([chat.currentUserId]);
    for (const readState of chat.readStates ?? []) {
      memberIds.add(readState.userId);
    }
    for (const message of messages) {
      memberIds.add(message.senderId);
    }
    return memberIds.size;
  }, [chat.currentUserId, chat.readStates, messages]);
  const memberCount = isCommunity && chat.searchMembers
    ? searchMembers.length
    : observedMemberCount;

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
      <StickerPreloader />
      {presentation === "full" && (
        <ChatHeader
          chatTitle={chatTitle}
          participantId={chat.participant.id}
          avatarUrl={chat.participant.avatarUrl}
          channelName={chat.channelName}
          isCommunity={isCommunity}
          memberCount={memberCount}
          membersOpen={rightSidebar === "members"}
          onToggleMembers={() => {
            if (rightSidebar === "members") {
              setRightSidebar(null);
              return;
            }

            invalidateSearch();
            closeDetails();
            setRightSidebar("members");
            clearSearchUrl();
          }}
          detailsAvailable={detailsAvailable}
          detailsOpen={detailsOpen}
          onToggleDetails={() => {
            setRightSidebar(null);
            toggleDetails();
          }}
          presenceStatus={participantPresence.status}
          presenceLabel={participantPresence.label}
          searchEnabled={searchEnabled}
          search={search}
          onSearchChange={setSearch}
          criteria={searchCriteria}
          onCriteriaChange={setSearchCriteria}
          members={searchMembers}
          channels={searchChannels}
          onSearchSubmit={submitSearch}
          onOpenFilters={() => setFiltersOpen(true)}
          conversationActions={conversationActions}
        />
      )}

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
          unreadBoundary,
          friendActionsEnabled,
          focusMessageId,
          getAuthorName: getMessageAuthorName,
          getAuthorAvatar: getMessageAuthorAvatar,
          getAuthorMember: getMessageAuthorMember,
        }}
        actions={{
          canDelete: Boolean(deleteMessageAction),
          reply: startReplyingToMessage,
          toggleReaction: handleToggleReaction,
          reportGif: handleReportGif,
          delete: handleDeleteMessage,
          retry: sendWithRequestId,
        }}
        editing={{
          enabled: Boolean(editMessageAction),
          messageId: editingMessage?.id ?? null,
          draft: editDraft,
          notice: editNotice,
          saving: isSavingEdit,
          start: startEditingMessage,
          change: handleEditDraftChange,
          save: () => void handleSaveEdit(),
          cancel: cancelEdit,
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
      {presentation === "full" && rightSidebar === "members" && (
        <MembersSidebar
          members={searchMembers}
          currentUserId={chat.currentUserId}
          currentUserRole={chat.currentUserRole}
          friendActionsEnabled={friendActionsEnabled}
          onClose={() => setRightSidebar(null)}
        />
      )}
      {presentation === "full" && searchEnabled && rightSidebar === "search" && (
        <SearchResultsSidebar
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
            setRightSidebar(null);
            clearSearchUrl();
          }}
          onOpenFilters={() => setFiltersOpen(true)}
          onSortChange={(direction) =>
            void runSearch(committedSearch, committedSearchCriteria, 1, direction)
          }
          onPageChange={(page) =>
            void runSearch(committedSearch, committedSearchCriteria, page, searchSort)
          }
        />
      )}
      </div>
      {presentation === "full" && searchEnabled && (
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
      )}
    </section>
  );
}
