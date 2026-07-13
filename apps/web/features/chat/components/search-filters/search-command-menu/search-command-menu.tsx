import {
  IconAdjustmentsHorizontal,
  IconAt,
  IconHash,
  IconPaperclip,
  IconSearch,
  IconTrash,
  IconUser,
  type Icon,
} from "@tabler/icons-react";
import {
  criterionOperator,
  criterionTokenValue,
  parseChatSearchQuery,
  type ChatSearchHistoryEntry,
  type ChatSearchOperator,
} from "@/features/chat/model/search";

interface SearchCommandMenuProps {
  onSelect: (operator: ChatSearchOperator | "more") => void;
  history: ChatSearchHistoryEntry[];
  onHistorySelect: (entry: ChatSearchHistoryEntry) => void;
  onClearHistory: () => void;
}

const commands: Array<{
  icon: Icon;
  operator: ChatSearchOperator | "more";
  title: string;
  hint: string;
}> = [
  {
    icon: IconUser,
    operator: "from",
    title: "From a specific user",
    hint: "from: user",
  },
  {
    icon: IconHash,
    operator: "in",
    title: "Sent in a specific channel",
    hint: "in: channel",
  },
  {
    icon: IconPaperclip,
    operator: "has",
    title: "Includes a specific type of data",
    hint: "has: link, embed or file",
  },
  {
    icon: IconAt,
    operator: "mentions",
    title: "Mentions a specific user",
    hint: "mentions: user",
  },
  {
    icon: IconAdjustmentsHorizontal,
    operator: "more",
    title: "More filters",
    hint: "dates, author type, and more",
  },
];

export function SearchCommandMenu({
  onSelect,
  history,
  onHistorySelect,
  onClearHistory,
}: SearchCommandMenuProps) {
  return (
    <div
      role="menu"
      aria-label="Search filters"
      className="max-h-search-discovery w-full overflow-y-auto rounded-card border border-divider bg-surface p-xs"
    >
      <p className="px-xs pb-xs text-ui-sm font-medium text-muted">Filters</p>
      {commands.map((command) => (
        <button
          key={command.operator}
          type="button"
          role="menuitem"
          onClick={() => onSelect(command.operator)}
          className="flex min-h-control w-full items-center gap-sm rounded-control px-xs py-xs text-left hover:bg-surface-2 focus-visible:bg-surface-2"
        >
          <command.icon
            size={20}
            stroke={1.75}
            aria-hidden="true"
            className="shrink-0 text-muted"
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-ui text-foreground">
              {command.title}
            </span>
            <span className="text-ui-sm text-muted">
              {command.hint}
            </span>
          </span>
        </button>
      ))}
      {history.length > 0 && (
        <section className="mt-xs border-t border-divider pt-sm" aria-labelledby="search-history-heading">
          <div className="flex min-h-control items-center justify-between px-xs">
            <p id="search-history-heading" className="text-ui-sm font-medium text-muted">
              History
            </p>
            <button
              type="button"
              aria-label="Clear search history"
              onClick={onClearHistory}
              className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
            >
              <IconTrash size={20} stroke={1.75} aria-hidden="true" />
            </button>
          </div>
          {history.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onHistorySelect(entry)}
              className="flex min-h-control w-full items-center gap-sm rounded-control px-xs text-left hover:bg-surface-2 focus-visible:bg-surface-2"
            >
              <IconSearch size={20} stroke={1.75} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="flex min-w-0 flex-wrap items-center gap-2xs">
                {parseChatSearchQuery(entry.query).text && <span className="truncate text-ui text-foreground">{parseChatSearchQuery(entry.query).text}</span>}
                {entry.criteria.map((criterion) => (
                  <span key={criterion.id} className="rounded-control bg-surface-3 px-xs py-2xs text-ui-sm text-body">
                    {criterionOperator(criterion)}: {criterionTokenValue(criterion)}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
