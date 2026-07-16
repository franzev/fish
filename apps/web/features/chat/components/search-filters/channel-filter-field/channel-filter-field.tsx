"use client";

import { IconButton } from "@/components/ui/icon-button";
import { SearchOption } from "@/components/ui/search-option";
import type { ChatSearchChannel } from "@/features/chat/model/search";
import { IconCheck, IconChevronDown, IconChevronUp, IconHash } from "@tabler/icons-react";
import { useMemo, useState } from "react";

interface ChannelFilterFieldProps {
  channels: ChatSearchChannel[];
  selectedIds: string[];
  onToggle: (channel: ChatSearchChannel) => void;
}

export function ChannelFilterField({ channels, selectedIds, onToggle }: ChannelFilterFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => channels.filter((channel) =>
    `${channel.name} ${channel.slug}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [channels, query]);

  return (
    <section className="flex flex-col gap-xs">
      <div>
        <h3 className="font-sans text-ui font-semibold text-foreground">In</h3>
        <p className="text-ui-sm text-muted">Sent in any of the selected channels</p>
      </div>
      <div className="flex min-h-control items-center rounded-control bg-surface-2">
        <input
          type="search"
          role="combobox"
          aria-label="Channel"
          aria-expanded={open}
          aria-controls="channel-filter-options"
          placeholder="ex. general"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          className="min-h-control min-w-0 flex-1 bg-transparent px-sm text-ui-md text-foreground placeholder:text-muted focus:outline-none md:text-ui [&::-webkit-search-cancel-button]:hidden"
        />
        <IconButton
          label={`${open ? "Close" : "Open"} channel suggestions`}
          appearance="ghost"
          tooltip={false}
          onClick={() => setOpen((current) => !current)}
          icon={open ? <IconChevronUp size={20} stroke={1.75} /> : <IconChevronDown size={20} stroke={1.75} />}
        />
      </div>
      {open && (
        <div id="channel-filter-options" role="listbox" aria-multiselectable="true" className="max-h-filter-options overflow-y-auto rounded-card bg-surface-2 p-xs">
          {results.map((channel) => {
            const selected = selectedIds.includes(channel.id);
            return (
              <SearchOption key={channel.id} selected={selected} onClick={() => onToggle(channel)}>
                <IconHash size={20} stroke={1.75} className="text-muted" />
                <span className="flex-1 text-ui text-foreground">{channel.name}</span>
                <span aria-hidden="true" className={`flex size-nav-badge-slot items-center justify-center ${selected ? "text-foreground" : "text-transparent"}`}>
                  <IconCheck size={20} stroke={2} />
                </span>
              </SearchOption>
            );
          })}
        </div>
      )}
    </section>
  );
}
