"use client";

import { Avatar } from "@/features/chat/components/avatar";
import type { ChatSearchMember } from "@/features/chat/model/search";
import { IconCheck, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useMemo, useState } from "react";

interface MemberFilterFieldProps {
  label: "From" | "Mentions";
  description: string;
  members: ChatSearchMember[];
  selectedIds: string[];
  onToggle: (member: ChatSearchMember) => void;
}

export function MemberFilterField({
  label,
  description,
  members,
  selectedIds,
  onToggle,
}: MemberFilterFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return members.filter((member) =>
      `${member.displayName} ${member.username}`
        .toLocaleLowerCase()
        .includes(normalized)
    );
  }, [members, query]);

  return (
    <section className="flex flex-col gap-xs">
      <div>
        <h3 className="font-sans text-heading-sm text-foreground">{label}</h3>
        <p className="text-copy text-muted">{description}</p>
      </div>
      <div className="relative">
        <div className="flex min-h-control items-center rounded-control border border-border bg-bg focus-within:border-border-strong">
          <input
            type="search"
            role="combobox"
            aria-label={`${label} user`}
            aria-expanded={open}
            aria-controls={`${label.toLowerCase()}-member-options`}
            placeholder="ex. franz1473"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            className="min-h-control min-w-0 flex-1 bg-transparent px-sm text-copy text-foreground placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="button"
            aria-label={`${open ? "Close" : "Open"} ${label.toLowerCase()} suggestions`}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted"
          >
            {open ? <IconChevronUp size={24} /> : <IconChevronDown size={24} />}
          </button>
        </div>
        {open && (
          <div
            id={`${label.toLowerCase()}-member-options`}
            role="listbox"
            aria-label={`${label} users`}
            aria-multiselectable="true"
            className="mt-2xs max-h-filter-options overflow-y-auto rounded-card border border-border bg-surface p-xs"
          >
            {results.length === 0 ? (
              <p className="px-xs py-sm text-ui-sm text-muted">No members match.</p>
            ) : results.map((member) => {
              const selected = selectedIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onToggle(member)}
                  className={`flex min-h-control w-full items-center gap-sm rounded-control px-xs text-left ${selected ? "bg-surface-2" : "hover:bg-surface-2"}`}
                >
                  <Avatar size="md" name={member.displayName} src={member.avatarUrl} />
                  <span className="min-w-0 flex-1 truncate text-copy font-semibold text-foreground">
                    {member.displayName}
                  </span>
                  <span className="truncate text-ui text-muted">{member.username}</span>
                  <span
                    aria-hidden="true"
                    className={`flex size-10 shrink-0 items-center justify-center rounded-control border ${selected ? "border-border-strong bg-surface-3 text-foreground" : "border-border text-transparent"}`}
                  >
                    <IconCheck size={20} stroke={2} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

