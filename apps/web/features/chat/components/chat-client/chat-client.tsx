"use client";

import type {
  ClientChatData,
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import { useTimeFormatPreference } from "@/lib/prefs/time-format";
import { useMemo, useRef, useState } from "react";
import type { SendMessageActionState } from "@/features/chat/contracts";
import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";
import type { LoadOlderMessagesActionState } from "@/features/chat/hooks/use-chat-messages";
import { useChatMessages } from "@/features/chat/hooks/use-chat-messages";
import { useChatPresence } from "@/features/chat/hooks/use-chat-presence";
import { useChatReadState } from "@/features/chat/hooks/use-chat-read-state";
import { useChatRealtime } from "@/features/chat/hooks/use-chat-realtime";
import { useLoadOlderMessages } from "@/features/chat/hooks/use-load-older-messages";
import { useStickToBottom } from "@/features/chat/hooks/use-stick-to-bottom";
import { useChatStore } from "@/features/chat/model/store";
import { ChatHeader } from "../chat-header";
import { ChatComposerSurface } from "../chat-composer-surface";
import { ChatMessageList } from "../chat-message-list";
import { visibleMessageBody } from "../message-presentation";
import {
  selectRealtimeStatusForConversation,
} from "@/features/chat/model/store";

export interface ChatClientProps {
  chat: ClientChatData;
  sendMessageAction: (input: unknown) => Promise<SendMessageActionState>;
  editMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  deleteMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  toggleReactionAction?: (input: unknown) => Promise<SendMessageActionState>;
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
  sendMessageAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
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
  const timeFormatPref = useTimeFormatPreference();
  const isCommunity = chat.kind === "community";
  const chatTitle = chat.title ?? chat.participant.displayName;
  const activityName = isCommunity ? "Someone" : chat.participant.displayName;
  const getMessageAuthorName = (message: ClientChatMessage) =>
    message.senderDisplayName ?? (isCommunity ? "Member" : chat.participant.displayName);
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
  const { hasOlderLoadError, loadOlderAndPreserveScroll } = useLoadOlderMessages({
    viewportRef,
    sentinelRef,
    hasMoreOlder,
    isLoadingOlder,
    hasLoadError,
    onLoadOlder: loadOlderMessages,
  });
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
  const {
    draft,
    notice,
    canSend,
    replyingTo,
    editingMessage,
    handleDraftChange,
    handleSend,
    sendWithRequestId,
    handleDeleteMessage,
    handleToggleReaction,
    startReplyingToMessage,
    startEditingMessage,
    cancelReply,
    cancelEdit,
    handleComposerKeyDown,
  } = useChatComposer({
    chat,
    messages,
    sendMessageAction,
    editMessageAction,
    deleteMessageAction,
    toggleReactionAction,
    sendLocalTyping,
    stopLocalTyping,
    scheduleLocalTypingStop,
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
  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return messages;
    }

    return messages.filter((message) =>
      visibleMessageBody(message).toLowerCase().includes(query)
    );
  }, [messages, search]);
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
        channelName={chat.channelName}
        isCommunity={isCommunity}
        memberCount={memberCount}
        presenceLabel={presenceStatus.label}
        showOnlineDot={presenceStatus.showOnlineDot}
        search={search}
        onSearchChange={setSearch}
      />

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
          visibleMessages: filteredMessages,
          allMessages: messages,
          participantTyping,
          search,
          isCommunity,
          activityName,
          chat,
          participantReadState,
          latestMineRequestId,
          getAuthorName: getMessageAuthorName,
        }}
        actions={{
          reply: startReplyingToMessage,
          toggleReaction: handleToggleReaction,
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
      />
    </section>
  );
}
