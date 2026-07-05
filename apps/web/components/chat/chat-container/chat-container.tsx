import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import { ChatHeader } from "../chat-header";
import { ChatInput } from "../chat-input";
import { EmptyState } from "../empty-state";
import { MessageList } from "../message-list";
import type { ChatMessageView, ChatParticipantView } from "../types";

interface ChatContainerProps extends HTMLAttributes<HTMLDivElement> {
  participant: ChatParticipantView;
  messages: ChatMessageView[];
  firstUnreadId?: string;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  onSend?: (value: string) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
}

/** The responsive chat shell: a column flex stacking ChatHeader (fixed top)
 *  + MessageList (flex-1, scrolls) + ChatInput (fixed bottom). Mobile-first
 *  full-width; on md: it sits within a bounded pane — responsive Tailwind
 *  prefixes only, no JS breakpoints. */
export function ChatContainer({
  participant,
  messages,
  firstUnreadId,
  loadingOlder,
  onLoadOlder,
  onSend,
  onReactionToggle,
  className,
  ...props
}: ChatContainerProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col bg-bg md:mx-auto md:max-w-content md:rounded-card md:border md:border-border",
        className
      )}
      {...props}
    >
      <ChatHeader participant={participant} />
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <MessageList
          messages={messages}
          firstUnreadId={firstUnreadId}
          loadingOlder={loadingOlder}
          onLoadOlder={onLoadOlder}
          onReactionToggle={onReactionToggle}
        />
      )}
      <ChatInput onSend={onSend} />
    </div>
  );
}
