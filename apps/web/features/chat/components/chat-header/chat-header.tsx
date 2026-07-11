import { SearchFilterPopover } from "../search-filters";

interface ChatHeaderProps {
  chatTitle: string;
  channelName?: string;
  isCommunity: boolean;
  memberCount: number;
  presenceLabel: string;
  showOnlineDot: boolean;
  search: string;
  onSearchChange: (value: string) => void;
}

export function ChatHeader({
  chatTitle,
  channelName,
  isCommunity,
  memberCount,
  presenceLabel,
  showOnlineDot,
  search,
  onSearchChange,
}: ChatHeaderProps) {
  return (
    <div className="border-b border-border bg-surface px-md">
      <div className="flex items-center justify-between gap-sm">
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
        <SearchFilterPopover value={search} onValueChange={onSearchChange} />
      </div>
    </div>
  );
}
