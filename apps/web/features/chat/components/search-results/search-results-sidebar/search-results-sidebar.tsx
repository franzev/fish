"use client";

import { Menu } from "@base-ui/react/menu";
import { IconAdjustmentsHorizontal, IconArrowsSort, IconX } from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import type { ChatSearchChannel, ChatSearchMember } from "@/features/chat/model/search";
import { SearchResultCard } from "../search-result-card";

interface SearchResultsSidebarProps {
  messages: LocalMessage[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortDirection: "asc" | "desc";
  filterCount: number;
  isSearching: boolean;
  notice: string | null;
  currentUserId: string;
  members: ChatSearchMember[];
  channels: ChatSearchChannel[];
  onClose: () => void;
  onOpenFilters: () => void;
  onSortChange: (direction: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
}

export function paginationItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, "ellipsis", total];
  if (current >= total - 2) return [1, "ellipsis", total - 2, total - 1, total];
  return [1, "ellipsis", current, "ellipsis", total];
}

export function SearchResultsSidebar(props: SearchResultsSidebarProps) {
  const totalPages = Math.max(1, Math.ceil(props.totalCount / props.pageSize));
  const hasSettledResults = props.messages.length > 0 && props.totalCount > 0;
  const isRefreshing = props.isSearching && hasSettledResults;
  const resultLabel = `${props.totalCount.toLocaleString()} ${props.totalCount === 1 ? "Result" : "Results"}`;
  const memberById = new Map(props.members.map((member) => [member.id, member]));
  const channelByConversation = new Map(props.channels.map((channel) => [channel.conversationId, channel]));
  const groups = new Map<string, LocalMessage[]>();
  for (const message of props.messages) {
    const current = groups.get(message.conversationId) ?? [];
    current.push(message);
    groups.set(message.conversationId, current);
  }
  return (
    <aside aria-label="Search results" aria-busy={props.isSearching} className="fixed inset-0 z-40 flex min-h-0 flex-col border-l border-divider bg-bg md:relative md:z-auto md:w-search-results md:shrink-0">
      <header className="border-b border-divider bg-surface p-sm">
        <div className="flex min-h-control items-center gap-xs">
          <h2 aria-live="polite" className="flex min-w-0 flex-1 items-center gap-xs whitespace-nowrap font-sans text-copy font-semibold text-foreground">
            {hasSettledResults || !props.isSearching ? resultLabel : "Searching"}
            {hasSettledResults && <span aria-hidden="true" className={`text-ui-sm font-medium text-muted ${isRefreshing ? "visible" : "invisible"}`}>Updating</span>}
          </h2>
          {isRefreshing && <span role="status" className="sr-only">Updating search results</span>}
          <button type="button" onClick={props.onOpenFilters} className="inline-flex min-h-control shrink-0 items-center gap-xs whitespace-nowrap rounded-control bg-surface-2 px-sm text-ui-sm font-medium text-body hover:bg-surface-3"><IconAdjustmentsHorizontal size={20} aria-hidden="true" />Filters{props.filterCount > 0 ? ` (${props.filterCount})` : ""}</button>
          <Menu.Root>
            <Menu.Trigger className="inline-flex min-h-control shrink-0 items-center gap-xs whitespace-nowrap rounded-control bg-surface-2 px-sm text-ui-sm font-medium text-body hover:bg-surface-3"><IconArrowsSort size={20} aria-hidden="true" />Sort</Menu.Trigger>
            <Menu.Portal><Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-50"><Menu.Popup className="min-w-menu rounded-card border border-divider bg-surface p-3xs">
              <Menu.Item onClick={() => props.onSortChange("desc")} className="flex min-h-control cursor-pointer items-center rounded-control px-sm text-ui text-foreground data-[highlighted]:bg-surface-2">Newest first{props.sortDirection === "desc" ? " ✓" : ""}</Menu.Item>
              <Menu.Item onClick={() => props.onSortChange("asc")} className="flex min-h-control cursor-pointer items-center rounded-control px-sm text-ui text-foreground data-[highlighted]:bg-surface-2">Oldest first{props.sortDirection === "asc" ? " ✓" : ""}</Menu.Item>
            </Menu.Popup></Menu.Positioner></Menu.Portal>
          </Menu.Root>
          <button type="button" aria-label="Close search results" onClick={props.onClose} className="inline-flex min-h-control min-w-control shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"><IconX size={20} stroke={1.75} aria-hidden="true" /></button>
        </div>
      </header>
      <ScrollArea className="flex-1" viewportClassName="p-sm">
        {props.isSearching && !hasSettledResults ? <div role="status" className="flex h-full items-center justify-center text-center text-ui-sm text-body">Searching messages…</div>
          : props.notice ? <p role="status" className="rounded-card bg-surface-2 p-md text-ui-sm text-notice">{props.notice}</p>
            : props.messages.length === 0 ? <div className="flex h-full items-center justify-center text-center text-ui-sm text-body">No messages match this search.</div>
              : [...groups].map(([conversationId, messages]) => {
                const channel = channelByConversation.get(conversationId);
                return <section key={conversationId} className="mb-lg" aria-labelledby={`result-channel-${conversationId}`}>
                  <h3 id={`result-channel-${conversationId}`} className="mb-xs text-ui-sm font-medium text-muted"># {channel?.name ?? "general"}</h3>
                  <div className="flex flex-col gap-xs">{messages.map((message) => {
                    const member = memberById.get(message.senderId);
                    return <SearchResultCard key={message.id} message={message} currentUserId={props.currentUserId} authorName={message.senderDisplayName ?? member?.displayName ?? "Member"} avatarUrl={member?.avatarUrl} />;
                  })}</div>
                </section>;
              })}
      </ScrollArea>
      {!props.notice && props.totalCount > 0 && <nav aria-label="Search result pages" aria-busy={props.isSearching} className="flex min-h-control items-center justify-center gap-2xs border-t border-divider bg-surface p-xs">
        <button type="button" disabled={props.isSearching || props.page === 1} onClick={() => props.onPageChange(props.page - 1)} className="min-h-control rounded-control px-xs text-ui-sm text-body disabled:text-muted">Back</button>
        {paginationItems(props.page, totalPages).map((item, index) => item === "ellipsis" ? <span key={`ellipsis-${index}`} className="px-2xs text-muted">…</span> : <button key={item} type="button" disabled={props.isSearching} aria-current={item === props.page ? "page" : undefined} onClick={() => props.onPageChange(item)} className={`min-h-control min-w-control rounded-control text-ui-sm disabled:text-muted ${item === props.page ? "bg-surface-3 font-medium text-foreground" : "text-body hover:bg-surface-2"}`}>{item}</button>)}
        <button type="button" disabled={props.isSearching || props.page === totalPages} onClick={() => props.onPageChange(props.page + 1)} className="min-h-control rounded-control px-xs text-ui-sm text-body disabled:text-muted">Next</button>
      </nav>}
    </aside>
  );
}
