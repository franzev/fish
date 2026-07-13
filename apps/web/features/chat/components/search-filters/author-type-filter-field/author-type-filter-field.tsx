import type { ChatSearchAuthorType } from "@/features/chat/model/search";

interface AuthorTypeFilterFieldProps {
  selected: ChatSearchAuthorType[];
  onToggle: (value: ChatSearchAuthorType) => void;
}

export function AuthorTypeFilterField({ selected, onToggle }: AuthorTypeFilterFieldProps) {
  return (
    <fieldset className="flex flex-col gap-xs">
      <legend className="font-sans text-ui font-semibold text-foreground">Author type</legend>
      <p className="text-ui-sm text-muted">Sent by any of the selected author types</p>
      <div className="grid grid-cols-2 gap-sm">
        {(["client", "coach"] as const).map((value) => (
          <label key={value} className={`flex min-h-control cursor-pointer items-center gap-xs rounded-control px-sm capitalize text-ui ${selected.includes(value) ? "bg-surface-3 text-foreground" : "bg-surface-2 text-body hover:bg-surface-3"}`}>
            <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} className="size-5 accent-current" />
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

