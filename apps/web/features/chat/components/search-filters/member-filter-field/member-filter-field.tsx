"use client";

import { IconButton } from "@/components/ui/icon-button";
import { SearchOption } from "@/components/ui/search-option";
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
        <h3 className="font-sans text-ui font-semibold text-foreground">{label}</h3>
        <p className="text-ui-sm text-muted">{description}</p>
      </div>
      <div className="relative">
        <div className="flex min-h-control items-center rounded-control bg-surface-2">
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
            className="min-h-control min-w-0 flex-1 bg-transparent px-sm text-ui text-foreground placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <IconButton
            label={`${open ? "Close" : "Open"} ${label.toLowerCase()} suggestions`}
            appearance="ghost"
            tooltip={false}
            onClick={() => setOpen((current) => !current)}
            icon={open ? <IconChevronUp size={20} stroke={1.75} /> : <IconChevronDown size={20} stroke={1.75} />}
          />
        </div>
        {open && (
          <div
            id={`${label.toLowerCase()}-member-options`}
            role="listbox"
            aria-label={`${label} users`}
            aria-multiselectable="true"
            className="mt-2xs max-h-filter-options overflow-y-auto rounded-card bg-surface-2 p-xs"
          >
            {results.length === 0 ? (
              <p className="px-xs py-sm text-ui-sm text-muted">No members match.</p>
            ) : results.map((member) => {
              const selected = selectedIds.includes(member.id);
              return (
                <SearchOption
                  key={member.id}
                  selected={selected}
                  onClick={() => onToggle(member)}
                >
                  <Avatar size="md" name={member.displayName} src={member.avatarUrl} />
                  <span className="min-w-0 flex-1 truncate text-ui text-foreground">
                    {member.displayName}
                  </span>
                  <span className="truncate text-ui-sm text-muted">{member.username}</span>
                  <span
                    aria-hidden="true"
                    className={`flex size-nav-badge-slot shrink-0 items-center justify-center ${selected ? "text-foreground" : "text-transparent"}`}
                  >
                    <IconCheck size={20} stroke={2} />
                  </span>
                </SearchOption>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
