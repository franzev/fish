import { Avatar } from "@/features/chat/components/avatar";
import type {
  ChatSearchChannel,
  ChatSearchMember,
} from "@/features/chat/model/search";
import {
  IconAdjustmentsHorizontal,
  IconAt,
  IconHash,
  IconSearch,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export type SearchDiscoverySelection =
  | { kind: "search" }
  | { kind: "filters" }
  | { kind: "from"; member: ChatSearchMember }
  | { kind: "channel"; channel: ChatSearchChannel }
  | { kind: "mentions"; member: ChatSearchMember };

interface SearchDiscoveryMenuProps {
  query: string;
  members: ChatSearchMember[];
  channels: ChatSearchChannel[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (selection: SearchDiscoverySelection) => void;
}

export function searchDiscoverySelections(
  _query: string,
  members: ChatSearchMember[],
  channels: ChatSearchChannel[]
): SearchDiscoverySelection[] {
  const matchedMembers = members.slice(0, 3);
  const matchedChannels = channels.slice(0, 3);
  return [
    { kind: "search" },
    { kind: "filters" },
    ...matchedMembers.map((member) => ({ kind: "from" as const, member })),
    ...matchedChannels.map((channel) => ({ kind: "channel" as const, channel })),
    ...matchedMembers.map((member) => ({ kind: "mentions" as const, member })),
  ];
}

export function SearchDiscoveryMenu({
  query,
  members,
  channels,
  activeIndex,
  onActiveIndexChange,
  onSelect,
}: SearchDiscoveryMenuProps) {
  const selections = searchDiscoverySelections(query, members, channels);
  const from = selections.filter(
    (selection): selection is Extract<SearchDiscoverySelection, { kind: "from" }> =>
      selection.kind === "from"
  );
  const inChannels = selections.filter(
    (selection): selection is Extract<SearchDiscoverySelection, { kind: "channel" }> =>
      selection.kind === "channel"
  );
  const mentions = selections.filter(
    (selection): selection is Extract<SearchDiscoverySelection, { kind: "mentions" }> =>
      selection.kind === "mentions"
  );
  let optionIndex = 0;
  const option = (
    selection: SearchDiscoverySelection,
    content: ReactNode
  ) => {
    const index = optionIndex++;
    const selected = index === activeIndex;
    return (
      <button
        key={
          selection.kind === "from" || selection.kind === "mentions"
            ? `${selection.kind}:${selection.member.id}`
            : selection.kind === "channel"
              ? `channel:${selection.channel.id}`
              : selection.kind
        }
        type="button"
        role="option"
        aria-selected={selected}
        onMouseEnter={() => onActiveIndexChange(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(selection)}
        className={`flex min-h-control w-full items-center gap-sm rounded-control px-xs text-left ${
          selected ? "bg-surface-2" : "hover:bg-surface-2"
        }`}
      >
        {content}
      </button>
    );
  };

  return (
    <div
      id="chat-search-discovery"
      role="listbox"
      aria-label="Search suggestions"
      className="flex max-h-search-discovery w-full flex-col overflow-y-auto rounded-card border border-divider bg-surface p-xs"
    >
      {option(
        { kind: "search" },
        <>
          <IconSearch size={20} stroke={1.75} className="shrink-0 text-muted" />
          <span className="truncate text-ui text-foreground">
            Search for {query}
          </span>
        </>
      )}
      {option(
        { kind: "filters" },
        <>
          <IconAdjustmentsHorizontal
            size={20}
            stroke={1.75}
            className="shrink-0 text-muted"
          />
          <span className="text-ui text-foreground">
            Add search filters
          </span>
        </>
      )}

      {from.length > 0 && (
        <section className="mt-xs border-t border-divider pt-sm" aria-labelledby="from-user-heading">
          <h2 id="from-user-heading" className="px-xs pb-xs font-sans text-ui-sm font-medium text-muted">
            From user
          </h2>
          {from.map((selection) =>
            option(
              selection,
              <>
                <Avatar size="sm" name={selection.member.displayName} src={selection.member.avatarUrl} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-ui text-foreground">
                    {selection.member.displayName}
                  </span>
                  <span className="truncate text-ui-sm text-muted">
                    from: {selection.member.username}
                  </span>
                </span>
              </>
            )
          )}
        </section>
      )}

      {inChannels.length > 0 && (
        <section className="mt-xs border-t border-divider pt-sm" aria-labelledby="in-channel-heading">
          <h2 id="in-channel-heading" className="px-xs pb-xs font-sans text-ui-sm font-medium text-muted">
            In channel
          </h2>
          {inChannels.map((selection) =>
            option(
              selection,
              <>
                <IconHash size={20} stroke={1.75} className="shrink-0 text-muted" />
                <span className="shrink-0 text-ui text-body">in:</span>
                <span aria-hidden="true" className="shrink-0 text-ui text-muted">
                  |
                </span>
                {" "}
                <span className="truncate text-ui font-medium text-foreground">
                  {selection.channel.name}
                </span>
              </>
            )
          )}
        </section>
      )}

      {mentions.length > 0 && (
        <section className="mt-xs border-t border-divider pt-sm" aria-labelledby="mentions-user-heading">
          <h2 id="mentions-user-heading" className="px-xs pb-xs font-sans text-ui-sm font-medium text-muted">
            Mentions user
          </h2>
          {mentions.map((selection) =>
            option(
              selection,
              <>
                <IconAt size={20} stroke={1.75} className="shrink-0 text-muted" />
                <Avatar size="sm" name={selection.member.displayName} src={selection.member.avatarUrl} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-ui text-foreground">
                    {selection.member.displayName}
                  </span>
                  <span className="truncate text-ui-sm text-muted">
                    mentions: {selection.member.username}
                  </span>
                </span>
              </>
            )
          )}
        </section>
      )}
    </div>
  );
}
