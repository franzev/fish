import { SearchFilterPopover } from "../search-filters";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import type {
  ChatFilterCriterion,
  ChatSearchChannel,
  ChatSearchMember,
} from "@/features/chat/model/search";
import {
  PresenceAvatar,
  type PresenceDisplayStatus,
} from "@/features/presence";
import { CallButton } from "@/features/calls";
import { cn } from "@/lib/utils";
import { Tooltip } from "@base-ui/react/tooltip";
import { IconUsers } from "@tabler/icons-react";

interface ChatHeaderProps {
  chatTitle: string;
  participantId?: string;
  avatarUrl?: string | null;
  channelName?: string;
  isCommunity: boolean;
  memberCount: number;
  membersOpen: boolean;
  onToggleMembers: () => void;
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
  membersOpen,
  onToggleMembers,
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
    <div className="flex h-chat-header shrink-0 items-center border-b border-divider bg-surface px-md">
      <div className="flex w-full items-center justify-between gap-sm">
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
        <div className="flex min-w-0 flex-1 items-center justify-end gap-sm">
          {isCommunity && (
            <Tooltip.Provider delay={400} closeDelay={0}>
              <TooltipIconButton
                type="button"
                label="Members"
                tooltipSide="bottom"
                aria-pressed={membersOpen}
                onClick={onToggleMembers}
                className={cn(
                  "shrink-0",
                  membersOpen && "bg-surface-3 text-foreground"
                )}
                icon={<IconUsers size={20} stroke={1.75} aria-hidden="true" />}
              />
            </Tooltip.Provider>
          )}
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
          {!isCommunity && participantId && (
            <div
              role="group"
              aria-label={`Call ${chatTitle}`}
              className="flex shrink-0 items-center gap-xs xl:hidden"
            >
              <CallButton
                recipientId={participantId}
                recipientName={chatTitle}
                kind="audio"
              />
              <CallButton
                recipientId={participantId}
                recipientName={chatTitle}
                kind="video"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
