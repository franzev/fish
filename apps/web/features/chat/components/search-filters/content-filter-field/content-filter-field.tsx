import type { ChatSearchContentKind } from "@/features/chat/model/search";
import { IconCheck, IconFile, IconLink, IconPhoto, IconPlayerPlay, IconVideo } from "@tabler/icons-react";

interface ContentFilterFieldProps {
  selected: ChatSearchContentKind[];
  onToggle: (kind: ChatSearchContentKind) => void;
}

const options = [
  { value: "image" as const, icon: IconPhoto },
  { value: "video" as const, icon: IconVideo },
  { value: "link" as const, icon: IconLink },
  { value: "file" as const, icon: IconFile },
  { value: "embed" as const, icon: IconPlayerPlay },
];

export function ContentFilterField({ selected, onToggle }: ContentFilterFieldProps) {
  return (
    <section className="flex flex-col gap-xs">
      <div>
        <h3 className="font-sans text-heading-sm text-foreground">Has</h3>
        <p className="text-copy text-muted">Includes any of the selected types of data</p>
      </div>
      <div role="listbox" aria-label="Content types" aria-multiselectable="true" className="max-h-filter-options overflow-y-auto rounded-card border border-border bg-surface p-xs">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button key={option.value} type="button" role="option" aria-selected={isSelected} onClick={() => onToggle(option.value)} className={`flex min-h-control w-full items-center gap-sm rounded-control px-xs text-left ${isSelected ? "bg-surface-2" : "hover:bg-surface-2"}`}>
              <option.icon size={24} stroke={1.75} className="text-muted" />
              <span className="flex-1 capitalize text-copy font-semibold text-foreground">{option.value}</span>
              <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-control border ${isSelected ? "border-border-strong bg-surface-3 text-foreground" : "border-border text-transparent"}`}>
                <IconCheck size={20} stroke={2} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

