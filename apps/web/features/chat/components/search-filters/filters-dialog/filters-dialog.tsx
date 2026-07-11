"use client";

import { Button } from "@/components/ui/button";
import {
  parseChatSearchQuery,
  queryFromCriteria,
  type ChatFilterCriterion,
  type ChatSearchAuthorType,
  type ChatSearchChannel,
  type ChatSearchContentKind,
  type ChatSearchMember,
} from "@/features/chat/model/search";
import { Dialog } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import { useState, type RefObject } from "react";
import { AuthorTypeFilterField } from "../author-type-filter-field";
import { ChannelFilterField } from "../channel-filter-field";
import { ContentFilterField } from "../content-filter-field";
import { DateFilterField } from "../date-filter-field";
import { MemberFilterField } from "../member-filter-field";
import { PinnedFilterField } from "../pinned-filter-field";

export interface FiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus?: RefObject<HTMLElement | null>;
  query?: string;
  criteria?: ChatFilterCriterion[];
  members?: ChatSearchMember[];
  channels?: ChatSearchChannel[];
  onApply?: (query: string, criteria: ChatFilterCriterion[]) => void;
}

const emptyCriteria: ChatFilterCriterion[] = [];
const emptyMembers: ChatSearchMember[] = [];
const emptyChannels: ChatSearchChannel[] = [];

export function FiltersDialog({
  open,
  ...props
}: FiltersDialogProps) {
  return open ? <OpenFiltersDialog open {...props} /> : null;
}

function OpenFiltersDialog({
  open,
  onOpenChange,
  finalFocus,
  query = "",
  criteria = emptyCriteria,
  members = emptyMembers,
  channels = emptyChannels,
  onApply,
}: FiltersDialogProps) {
  const [draft, setDraft] = useState(criteria);

  const memberCriteria = (kind: "from" | "mentions") =>
    draft.filter(
      (criterion): criterion is Extract<ChatFilterCriterion, { kind: typeof kind }> =>
        criterion.kind === kind
    );
  const toggleMember = (kind: "from" | "mentions", member: ChatSearchMember) => {
    const exists = draft.some(
      (criterion) => criterion.kind === kind && criterion.member.id === member.id
    );
    setDraft(
      exists
        ? draft.filter(
            (criterion) =>
              !(criterion.kind === kind && criterion.member.id === member.id)
          )
        : [...draft, { id: `${kind}:${member.username}`, kind, member }]
    );
  };
  const toggleChannel = (channel: ChatSearchChannel) => {
    const exists = draft.some(
      (criterion) => criterion.kind === "in" && criterion.channel.id === channel.id
    );
    setDraft(
      exists
        ? draft.filter(
            (criterion) =>
              !(criterion.kind === "in" && criterion.channel.id === channel.id)
          )
        : [...draft, { id: `in:${channel.slug}`, kind: "in", channel }]
    );
  };
  const toggleContent = (contentKind: ChatSearchContentKind) => {
    const exists = draft.some(
      (criterion) =>
        criterion.kind === "has" && criterion.contentKind === contentKind
    );
    setDraft(
      exists
        ? draft.filter(
            (criterion) =>
              !(criterion.kind === "has" && criterion.contentKind === contentKind)
          )
        : [...draft, { id: `has:${contentKind}`, kind: "has", contentKind }]
    );
  };
  const toggleAuthor = (authorType: ChatSearchAuthorType) => {
    const exists = draft.some(
      (criterion) =>
        criterion.kind === "author" && criterion.authorType === authorType
    );
    setDraft(
      exists
        ? draft.filter(
            (criterion) =>
              !(criterion.kind === "author" && criterion.authorType === authorType)
          )
        : [...draft, { id: `author:${authorType}`, kind: "author", authorType }]
    );
  };
  const pinned = draft.find(
    (criterion): criterion is Extract<ChatFilterCriterion, { kind: "pinned" }> =>
      criterion.kind === "pinned"
  );

  const apply = () => {
    const text = parseChatSearchQuery(query).text;
    const nextQuery = queryFromCriteria(text, draft);
    onApply?.(nextQuery, draft);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Popup
          finalFocus={finalFocus}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-filters-sheet flex-col overflow-hidden rounded-t-card border border-border bg-surface md:inset-0 md:m-auto md:h-fit md:w-content md:rounded-card lg:w-filters-dialog"
        >
          <header className="flex items-center justify-between gap-sm border-b border-border px-lg py-sm">
            <div>
              <Dialog.Title className="font-sans text-heading text-foreground">
                Filters
              </Dialog.Title>
              <Dialog.Description className="text-ui-sm text-muted">
                Narrow the messages shown in this conversation.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close filters"
              className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
            >
              <IconX size={22} stroke={1.75} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-lg overflow-y-auto px-lg py-lg lg:grid-cols-2">
            <div className="flex flex-col gap-lg">
              <MemberFilterField
                label="From"
                description="Sent by any of the selected users"
                members={members}
                selectedIds={memberCriteria("from").map((criterion) => criterion.member.id)}
                onToggle={(member) => toggleMember("from", member)}
              />
              <MemberFilterField
                label="Mentions"
                description="Mentions any of the selected users"
                members={members}
                selectedIds={memberCriteria("mentions").map((criterion) => criterion.member.id)}
                onToggle={(member) => toggleMember("mentions", member)}
              />
              <ChannelFilterField
                channels={channels}
                selectedIds={draft.flatMap((criterion) =>
                  criterion.kind === "in" ? [criterion.channel.id] : []
                )}
                onToggle={toggleChannel}
              />
              <ContentFilterField
                selected={draft.flatMap((criterion) =>
                  criterion.kind === "has" ? [criterion.contentKind] : []
                )}
                onToggle={toggleContent}
              />
            </div>
            <div className="flex flex-col gap-lg">
              <DateFilterField
                criteria={draft.filter(
                  (criterion): criterion is Extract<ChatFilterCriterion, { kind: "date" }> =>
                    criterion.kind === "date"
                )}
                onChange={(dates) =>
                  setDraft([
                    ...draft.filter((criterion) => criterion.kind !== "date"),
                    ...dates,
                  ])
                }
              />
              <AuthorTypeFilterField
                selected={draft.flatMap((criterion) =>
                  criterion.kind === "author" ? [criterion.authorType] : []
                )}
                onToggle={toggleAuthor}
              />
              <PinnedFilterField
                value={pinned?.value ?? null}
                onChange={(value) =>
                  setDraft([
                    ...draft.filter((criterion) => criterion.kind !== "pinned"),
                    ...(value === null
                      ? []
                      : [{ id: `pinned:${value}`, kind: "pinned" as const, value }]),
                  ])
                }
              />
            </div>
          </div>

          <footer className="grid grid-cols-2 items-center gap-sm border-t border-border px-lg py-sm sm:flex">
            <button
              type="button"
              onClick={() => setDraft([])}
              className="col-span-2 min-h-control rounded-control px-xs text-copy font-semibold text-notice hover:text-body sm:col-span-1"
            >
              Clear filters ({draft.length})
            </button>
            <span aria-hidden="true" className="hidden flex-1 sm:block" />
            <Button className="w-full sm:w-auto" variant="ghost" fullWidth={false} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" fullWidth={false} onClick={apply}>
              Apply filters
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
