import { Avatar } from "@/features/chat/components/avatar";
import type {
  ChatSearchChannel,
  ChatSearchContentKind,
  ChatSearchMember,
  ChatSearchOperator,
} from "@/features/chat/model/search";
import {
  IconCalendar,
  IconFile,
  IconHash,
  IconLink,
  IconPhoto,
  IconPinned,
  IconPlayerPlay,
  IconUser,
  IconVideo,
} from "@tabler/icons-react";

export type SearchSuggestion =
  | { kind: "member"; member: ChatSearchMember }
  | { kind: "channel"; channel: ChatSearchChannel }
  | { kind: "content"; value: ChatSearchContentKind }
  | { kind: "author"; value: "client" | "coach" }
  | { kind: "pinned"; value: boolean }
  | { kind: "date"; value: string };

interface SearchSuggestionsProps {
  operator: ChatSearchOperator;
  suggestions: SearchSuggestion[];
  activeIndex: number;
  onSelect: (suggestion: SearchSuggestion) => void;
}

const contentIcons = {
  image: IconPhoto,
  video: IconVideo,
  link: IconLink,
  file: IconFile,
  embed: IconPlayerPlay,
};

const headings: Record<ChatSearchOperator, string> = {
  from: "From User",
  mentions: "Mentions User",
  in: "In Channel",
  has: "Has",
  author: "Author Type",
  pinned: "Pinned",
  before: "Before Date",
  after: "After Date",
  during: "During Date",
};

function suggestionLabel(suggestion: SearchSuggestion): string {
  switch (suggestion.kind) {
    case "member":
      return `${suggestion.member.displayName} ${suggestion.member.username}`;
    case "channel":
      return suggestion.channel.name;
    case "content":
    case "author":
      return suggestion.value;
    case "pinned":
      return suggestion.value ? "Pinned messages" : "Not pinned";
    case "date":
      return suggestion.value;
  }
}

export function SearchSuggestions({
  operator,
  suggestions,
  activeIndex,
  onSelect,
}: SearchSuggestionsProps) {
  return (
    <div
      id="chat-search-suggestions"
      role="listbox"
      aria-label={headings[operator]}
      className="w-search-pop-mobile rounded-card border border-border bg-surface p-sm shadow-popover sm:w-search-pop"
    >
      <p className="px-xs pb-xs text-ui-sm font-semibold text-muted">
        {headings[operator]}
      </p>
      {suggestions.length === 0 ? (
        <p className="px-xs py-sm text-ui-sm text-muted">No matches yet.</p>
      ) : (
        <div className="flex max-h-search-suggestions flex-col overflow-y-auto">
          {suggestions.map((suggestion, index) => {
            const selected = index === activeIndex;
            const label = suggestionLabel(suggestion);
            return (
              <button
                key={`${suggestion.kind}:${label}`}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(suggestion)}
                className={`flex min-h-control w-full items-center gap-xs rounded-control px-xs text-left ${
                  selected ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                {suggestion.kind === "member" ? (
                  <>
                    <Avatar
                      size="md"
                      name={suggestion.member.displayName}
                      src={suggestion.member.avatarUrl}
                    />
                    <span className="min-w-0 truncate text-ui font-semibold text-foreground">
                      {suggestion.member.displayName}{" "}
                      <span className="font-normal text-muted">
                        {suggestion.member.username}
                      </span>
                    </span>
                  </>
                ) : suggestion.kind === "channel" ? (
                  <>
                    <IconHash size={24} stroke={1.75} className="text-muted" />
                    <span className="text-ui font-semibold text-foreground">
                      {suggestion.channel.name}
                    </span>
                  </>
                ) : suggestion.kind === "content" ? (
                  (() => {
                    const ContentIcon = contentIcons[suggestion.value];
                    return (
                      <>
                        <ContentIcon size={24} stroke={1.75} className="text-muted" />
                        <span className="capitalize text-ui font-semibold text-foreground">
                          {suggestion.value}
                        </span>
                      </>
                    );
                  })()
                ) : suggestion.kind === "author" ? (
                  <>
                    <IconUser size={24} stroke={1.75} className="text-muted" />
                    <span className="capitalize text-ui font-semibold text-foreground">
                      {suggestion.value}
                    </span>
                  </>
                ) : suggestion.kind === "pinned" ? (
                  <>
                    <IconPinned size={24} stroke={1.75} className="text-muted" />
                    <span className="text-ui font-semibold text-foreground">{label}</span>
                  </>
                ) : (
                  <>
                    <IconCalendar size={24} stroke={1.75} className="text-muted" />
                    <span className="text-ui font-semibold text-foreground">{label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
