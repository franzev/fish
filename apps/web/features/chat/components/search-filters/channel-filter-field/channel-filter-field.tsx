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
          className="min-h-control min-w-0 flex-1 bg-transparent px-sm text-ui text-foreground placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          aria-label={`${open ? "Close" : "Open"} channel suggestions`}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted"
        >
          {open ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
        </button>
      </div>
      {open && (
        <div id="channel-filter-options" role="listbox" aria-multiselectable="true" className="max-h-filter-options overflow-y-auto rounded-card bg-surface-2 p-xs">
          {results.map((channel) => {
            const selected = selectedIds.includes(channel.id);
            return (
              <button key={channel.id} type="button" role="option" aria-selected={selected} onClick={() => onToggle(channel)} className={`flex min-h-control w-full items-center gap-sm rounded-control px-xs text-left ${selected ? "bg-surface-3" : "hover:bg-surface-3"}`}>
                <IconHash size={20} stroke={1.75} className="text-muted" />
                <span className="flex-1 text-ui text-foreground">{channel.name}</span>
                <span aria-hidden="true" className={`flex size-10 items-center justify-center ${selected ? "text-foreground" : "text-transparent"}`}>
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
