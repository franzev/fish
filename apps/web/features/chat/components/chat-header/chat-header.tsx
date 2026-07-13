import { SearchFilterPopover } from "../search-filters";
import type {
  ChatFilterCriterion,
  ChatSearchChannel,
  ChatSearchMember,
} from "@/features/chat/model/search";
import { Avatar } from "../avatar";

interface ChatHeaderProps {
  chatTitle: string;
  participantId?: string;
  avatarUrl?: string | null;
  channelName?: string;
  isCommunity: boolean;
  memberCount: number;
  presenceLabel: string;
  showOnlineDot: boolean;
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
  presenceLabel,
  showOnlineDot,
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
        <div className="flex min-w-0 items-center gap-2xs">
          {!isCommunity && (
            <Avatar
              profileId={participantId}
              src={avatarUrl ?? undefined}
              name={chatTitle}
              size="md"
              alt=""
            />
          )}
          <div className="flex min-w-0 items-baseline gap-2xs">
          <h1 className="truncate font-sans text-heading text-foreground">
            {isCommunity ? `# ${channelName ?? chatTitle}` : chatTitle}
          </h1>
          <span className="flex shrink-0 items-center gap-nudge text-ui-sm text-muted">
            {!isCommunity && showOnlineDot && (
              <span
                aria-label="Participant is online"
                className="size-2 rounded-pill bg-success"
              />
            )}
            <span>
              {isCommunity
                ? `· ${memberCount} ${memberCount === 1 ? "member" : "members"}`
                : presenceLabel}
            </span>
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
