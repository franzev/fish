"use client";

import { IconButton } from "@/components/ui/icon-button";
import { IconSearch, IconX } from "@tabler/icons-react";
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  addChatSearchHistory,
  appendChatSearchOperator,
  clearChatSearchHistory,
  criterionFromSuggestion,
  criterionKey,
  makeCriterion,
  parseChatSearchQuery,
  queryFromCriteria,
  readChatSearchHistory,
  reconcileCriteria,
  replaceChatSearchToken,
  suggestionsForToken,
  suggestionValue,
  type SearchSuggestion,
  type ChatFilterCriterion,
  type ChatSearchChannel,
  type ChatSearchHistoryEntry,
  type ChatSearchMember,
  type ChatSearchOperator,
  type ChatSearchToken,
} from "@/features/chat/model/search";
import { cn } from "@/lib/utils";
import { SearchCommandMenu } from "../search-command-menu";
import {
  SearchDiscoveryMenu,
  searchDiscoverySelections,
  type SearchDiscoverySelection,
} from "../search-discovery-menu";
import { SearchSuggestions } from "../search-suggestions";

export interface SearchFilterPopoverProps {
  value: string;
  onValueChange: (value: string) => void;
  criteria?: ChatFilterCriterion[];
  onCriteriaChange?: (criteria: ChatFilterCriterion[]) => void;
  members?: ChatSearchMember[];
  channels?: ChatSearchChannel[];
  onSubmit?: (query: string, criteria: ChatFilterCriterion[]) => void;
  onOpenFilters?: () => void;
}

const emptyCriteria: ChatFilterCriterion[] = [];
const emptyMembers: ChatSearchMember[] = [];
const emptyChannels: ChatSearchChannel[] = [];
function renderTokenizedSearchValue(
  value: string,
  tokens: ChatSearchToken[]
): ReactNode[] {
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const token of tokens) {
    if (token.start > offset) {
      parts.push(
        <span key={`text:${offset}`} className="whitespace-pre">
          {value.slice(offset, token.start)}
        </span>
      );
    }
    parts.push(
      <span
        key={`${token.start}:${token.end}`}
        data-testid="search-filter-token"
        className="-mx-2xs rounded-control bg-surface-2 px-2xs py-2xs text-foreground"
      >
        {value.slice(token.start, token.end)}
      </span>
    );
    offset = token.end;
  }
  if (offset < value.length) {
    parts.push(
      <span key={`text:${offset}`} className="whitespace-pre">
        {value.slice(offset)}
      </span>
    );
  }
  return parts;
}

export function SearchFilterPopover({
  value,
  onValueChange,
  criteria = emptyCriteria,
  onCriteriaChange,
  members = emptyMembers,
  channels = emptyChannels,
  onSubmit = () => undefined,
  onOpenFilters = () => undefined,
}: SearchFilterPopoverProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caret, setCaret] = useState(value.length);
  const [history, setHistory] = useState<ChatSearchHistoryEntry[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const tokenLayerRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  const criteriaRef = useRef(criteria);
  const panelOpenRef = useRef(panelOpen);
  const pendingSelectionRef = useRef<{ value: string; criteria: ChatFilterCriterion[] } | null>(null);
  useEffect(() => {
    valueRef.current = value;
    criteriaRef.current = criteria;
    panelOpenRef.current = panelOpen;
  }, [criteria, panelOpen, value]);
  const parsed = useMemo(() => parseChatSearchQuery(value, caret), [caret, value]);
  const soleToken = parsed.tokens.length === 1 && parsed.tokens[0]?.start === 0 && parsed.text.length === 0
    ? parsed.tokens[0]
    : null;
  const soleTokenKey = soleToken?.value
    ? `${soleToken.operator}:${soleToken.value.toLocaleLowerCase()}`
    : null;
  const tokenModeToken = soleToken && !criteria.some((criterion) => criterionKey(criterion) === soleTokenKey)
    ? soleToken
    : null;
  // A selection closes the panel before focus returns to the input. Keep the
  // selected token visible, but let the next Enter submit the selected
  // criterion instead of reopening the same suggestion.
  const activeToken = panelOpen ? (parsed.activeToken ?? tokenModeToken) : null;
  const tokenMode = tokenModeToken !== null;
  const showTokenLayer = !tokenMode && parsed.tokens.some((token) => token.value.length > 0);
  const canonicalCaret = (selectionStart: number | null) => {
    const position = selectionStart ?? value.length;
    return tokenModeToken ? tokenModeToken.valueStart + position : position;
  };

  const suggestions = useMemo(
    () => (activeToken ? suggestionsForToken(activeToken, members, channels) : []),
    [activeToken, channels, members]
  );

  const discovery = !activeToken && value.trim() ? searchDiscoverySelections(value, members, channels) : [];
  const updateValue = (nextValue: string, nextCaret = nextValue.length) => {
    pendingSelectionRef.current = null;
    valueRef.current = nextValue;
    criteriaRef.current = reconcileCriteria(nextValue, criteria);
    onValueChange(nextValue);
    onCriteriaChange?.(criteriaRef.current);
    setCaret(nextCaret);
    setActiveIndex(0);
  };
  const focusAt = (position: number) => requestAnimationFrame(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(position, position);
  });
  const submit = (query: string, nextCriteria: ChatFilterCriterion[]) => {
    if (!parseChatSearchQuery(query).text && nextCriteria.length === 0) return;
    setHistory(addChatSearchHistory(query, nextCriteria));
    setPanelOpen(false);
    onSubmit(query, nextCriteria);
  };
  const selectSuggestion = (suggestion: SearchSuggestion) => {
    if (!activeToken) return;
    const replacement = replaceChatSearchToken(value, activeToken, suggestionValue(suggestion));
    const criterion = criterionFromSuggestion(activeToken.operator, suggestion);
    const nextCriteria = criterion ? [...criteria.filter((item) => item.id !== criterion.id), criterion] : criteria;
    valueRef.current = replacement.value;
    criteriaRef.current = nextCriteria;
    pendingSelectionRef.current = { value: replacement.value, criteria: nextCriteria };
    onValueChange(replacement.value);
    onCriteriaChange?.(nextCriteria);
    setCaret(replacement.caret);
    setActiveIndex(0);
    panelOpenRef.current = false;
    setPanelOpen(false);
    focusAt(replacement.caret);
  };
  const selectDiscovery = (selection: SearchDiscoverySelection) => {
    if (selection.kind === "search") return submit(value, criteria);
    if (selection.kind === "filters") { setPanelOpen(false); onOpenFilters(); return; }
    const criterion: ChatFilterCriterion = selection.kind === "from"
      ? makeCriterion("from", selection.member)
      : selection.kind === "mentions"
        ? makeCriterion("mentions", selection.member)
        : makeCriterion("in", selection.channel);
    const nextCriteria = [...criteria.filter((item) => item.id !== criterion.id), criterion];
    const nextQuery = queryFromCriteria(parsed.text, nextCriteria);
    valueRef.current = nextQuery;
    criteriaRef.current = nextCriteria;
    onValueChange(nextQuery);
    onCriteriaChange?.(nextCriteria);
    setCaret(nextQuery.length);
    setActiveIndex(0);
    focusAt(nextQuery.length);
  };
  const selectCommand = (operator: ChatSearchOperator | "more") => {
    if (operator === "more") { setPanelOpen(false); onOpenFilters(); return; }
    const next = appendChatSearchOperator(value, operator);
    updateValue(next.value, next.caret);
    focusAt(next.caret);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const panelIsOpen = panelOpenRef.current;
    const currentActiveToken = panelIsOpen ? activeToken : null;
    const options = currentActiveToken ? suggestions : panelIsOpen ? discovery : [];
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0))); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); return; }
    if (event.key === "Escape") { event.preventDefault(); setPanelOpen(false); return; }
    if (event.key === "Enter") {
      event.preventDefault();
      const pendingSelection = pendingSelectionRef.current;
      if (pendingSelection) {
        pendingSelectionRef.current = null;
        submit(pendingSelection.value, pendingSelection.criteria);
        return;
      }
      if (currentActiveToken && suggestions[activeIndex]) selectSuggestion(suggestions[activeIndex]);
      else if (panelIsOpen && discovery[activeIndex]) selectDiscovery(discovery[activeIndex]);
      else submit(valueRef.current, criteriaRef.current);
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative flex min-w-0 max-w-search-header flex-1 flex-col gap-2xs"
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !rootRef.current?.contains(nextTarget)) {
          setPanelOpen(false);
        }
      }}
    >
      <div className="relative flex min-h-target-touch min-w-0 items-center rounded-control border border-divider bg-bg sm:min-h-search-control">
        {tokenModeToken && <span className="ml-md rounded-control bg-surface-2 px-xs py-2xs text-ui text-foreground">{tokenModeToken.operator}:</span>}
        <div className="relative min-w-0 flex-1">
          {showTokenLayer && (
            <div
              ref={tokenLayerRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="flex min-h-target-touch w-max items-center whitespace-pre px-md text-ui text-foreground sm:min-h-search-control">
                {renderTokenizedSearchValue(value, parsed.tokens)}
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label="Search messages"
            aria-autocomplete="list"
            aria-controls="chat-search-panel"
            aria-expanded={panelOpen}
            placeholder={tokenMode ? "" : "Search"}
            value={tokenModeToken ? tokenModeToken.value : value}
            onFocus={() => { setHistory(readChatSearchHistory()); setPanelOpen(true); setActiveIndex(0); }}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const next = tokenModeToken ? `${tokenModeToken.operator}: ${event.target.value}` : event.target.value;
              updateValue(next, next.length);
              setPanelOpen(true);
            }}
            onClick={(event) => { setCaret(canonicalCaret(event.currentTarget.selectionStart)); setPanelOpen(true); }}
            onKeyUp={(event) => setCaret(canonicalCaret(event.currentTarget.selectionStart))}
    onKeyDown={handleKeyDown}
            onScroll={(event) => {
              if (tokenLayerRef.current) {
                tokenLayerRef.current.scrollLeft = event.currentTarget.scrollLeft;
              }
            }}
            className={cn(
              "min-h-target-touch w-full min-w-0 bg-transparent px-md text-ui-md text-foreground placeholder:text-muted focus:outline-none sm:min-h-search-control md:text-ui [&::-webkit-search-cancel-button]:hidden",
              showTokenLayer && "text-transparent caret-foreground selection:bg-surface-3"
            )}
          />
        </div>
        {!value && <span className="pointer-events-none flex min-h-target-touch min-w-target-touch shrink-0 items-center justify-center text-muted sm:min-h-search-control sm:min-w-search-control"><IconSearch size={16} stroke={1.75} aria-hidden="true" /></span>}
        {value && <IconButton label="Clear search" appearance="ghost" tooltip={false} onMouseDown={(event) => event.preventDefault()} onClick={() => { updateValue(""); setPanelOpen(true); }} className="sm:size-search-control sm:min-h-search-control" icon={<IconX size={20} stroke={1.75} aria-hidden="true" />} />}
      </div>

      {panelOpen && <div id="chat-search-panel" className="absolute right-0 top-full z-30 mt-2xs w-full">
        {activeToken ? <SearchSuggestions operator={activeToken.operator} suggestions={suggestions} activeIndex={Math.min(activeIndex, Math.max(suggestions.length - 1, 0))} onSelect={selectSuggestion} />
          : value.trim() ? <SearchDiscoveryMenu query={value} members={members} channels={channels} activeIndex={activeIndex} onActiveIndexChange={setActiveIndex} onSelect={selectDiscovery} />
            : <SearchCommandMenu onSelect={selectCommand} history={history} onHistorySelect={(entry) => { onValueChange(entry.query); onCriteriaChange?.(entry.criteria); submit(entry.query, entry.criteria); }} onClearHistory={() => { clearChatSearchHistory(); setHistory([]); }} />}
      </div>}
    </div>
  );
}
