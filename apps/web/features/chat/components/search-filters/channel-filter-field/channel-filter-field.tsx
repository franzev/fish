"use client";

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
        <h3 className="font-sans text-heading-sm text-foreground">In</h3>
        <p className="text-copy text-muted">Sent in any of the selected channels</p>
      </div>
      <div className="flex min-h-control items-center rounded-control border border-border bg-bg focus-within:border-border-strong">
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
          className="min-h-control min-w-0 flex-1 bg-transparent px-sm text-copy text-foreground placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          aria-label={`${open ? "Close" : "Open"} channel suggestions`}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted"
        >
          {open ? <IconChevronUp size={24} /> : <IconChevronDown size={24} />}
        </button>
      </div>
      {open && (
        <div id="channel-filter-options" role="listbox" aria-multiselectable="true" className="max-h-filter-options overflow-y-auto rounded-card border border-border bg-surface p-xs">
          {results.map((channel) => {
            const selected = selectedIds.includes(channel.id);
            return (
              <button key={channel.id} type="button" role="option" aria-selected={selected} onClick={() => onToggle(channel)} className={`flex min-h-control w-full items-center gap-sm rounded-control px-xs text-left ${selected ? "bg-surface-2" : "hover:bg-surface-2"}`}>
                <IconHash size={24} stroke={1.75} className="text-muted" />
                <span className="flex-1 text-copy font-semibold text-foreground">{channel.name}</span>
                <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-control border ${selected ? "border-border-strong bg-surface-3 text-foreground" : "border-border text-transparent"}`}>
                  <IconCheck size={20} stroke={2} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

