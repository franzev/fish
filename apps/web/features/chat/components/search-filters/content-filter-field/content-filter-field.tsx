import { SearchOption } from "@/components/ui/search-option";
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
        <h3 className="font-sans text-ui font-semibold text-foreground">Has</h3>
        <p className="text-ui-sm text-muted">Includes any of the selected types of data</p>
      </div>
      <div role="listbox" aria-label="Content types" aria-multiselectable="true" className="max-h-filter-options overflow-y-auto rounded-card bg-surface-2 p-xs">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <SearchOption key={option.value} selected={isSelected} onClick={() => onToggle(option.value)}>
              <option.icon size={20} stroke={1.75} className="text-muted" />
              <span className="flex-1 capitalize text-ui text-foreground">{option.value}</span>
              <span aria-hidden="true" className={`flex size-nav-badge-slot items-center justify-center ${isSelected ? "text-foreground" : "text-transparent"}`}>
                <IconCheck size={20} stroke={2} />
              </span>
            </SearchOption>
          );
        })}
      </div>
    </section>
  );
}
