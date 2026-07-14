import { SearchFilterPopover } from "../search-filters";
import type {
  ChatFilterCriterion,
  ChatSearchChannel,
  ChatSearchMember,
} from "@/features/chat/model/search";
import {
  PresenceAvatar,
  type PresenceDisplayStatus,
} from "@/features/presence";

interface ChatHeaderProps {
  chatTitle: string;
  participantId?: string;
  avatarUrl?: string | null;
  channelName?: string;
  isCommunity: boolean;
  memberCount: number;
  presenceStatus: PresenceDisplayStatus;
  presenceLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  criteria: ChatFilterCriterion[];
  onCriteriaChange: (criteria: ChatFilterCriterion[]) => void;
  members: ChatSearchMember[];
  channels: ChatSearchChannel[];
  onSearchSubmit: (query: string, criteria: ChatFilterCriterion[]) => void;
  onOpenFilters: () => void;
}

export function ChatHeader({
  chatTitle,
  participantId,
  avatarUrl,
  channelName,
  isCommunity,
  memberCount,
  presenceStatus,
  presenceLabel,
  search,
  onSearchChange,
  criteria,
  onCriteriaChange,
  members,
  channels,
  onSearchSubmit,
  onOpenFilters,
}: ChatHeaderProps) {
  return (
    <div className="border-b border-divider bg-surface px-md py-xs">
      <div className="flex items-center justify-between gap-sm">
        <div className="flex min-w-0 items-center gap-sm">
          {!isCommunity && (
            <PresenceAvatar
              profileId={participantId}
              src={avatarUrl ?? undefined}
              name={chatTitle}
              size="md"
              alt=""
              status={presenceStatus}
              statusLabel={presenceLabel}
            />
          )}
          <div className="flex min-w-0 flex-col gap-3xs">
            <h1 className="truncate font-sans text-ui-md font-semibold text-foreground">
              {isCommunity ? `# ${channelName ?? chatTitle}` : chatTitle}
            </h1>
            <span className="truncate text-ui-xs text-muted">
              {isCommunity
                ? `· ${memberCount} ${memberCount === 1 ? "member" : "members"}`
                : presenceLabel}
            </span>
          </div>
        </div>
        <SearchFilterPopover
          value={search}
          onValueChange={onSearchChange}
          criteria={criteria}
          onCriteriaChange={onCriteriaChange}
          members={members}
          channels={channels}
          onSubmit={onSearchSubmit}
          onOpenFilters={onOpenFilters}
        />
      </div>
    </div>
  );
}
