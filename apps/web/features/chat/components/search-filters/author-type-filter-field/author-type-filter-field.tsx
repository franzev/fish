import type { ChatSearchAuthorType } from "@/features/chat/model/search";

interface AuthorTypeFilterFieldProps {
  selected: ChatSearchAuthorType[];
  onToggle: (value: ChatSearchAuthorType) => void;
}

export function AuthorTypeFilterField({ selected, onToggle }: AuthorTypeFilterFieldProps) {
  return (
    <fieldset className="flex flex-col gap-xs">
      <legend className="font-sans text-heading-sm text-foreground">Author type</legend>
      <p className="text-copy text-muted">Sent by any of the selected author types</p>
      <div className="grid grid-cols-2 gap-sm">
        {(["client", "coach"] as const).map((value) => (
          <label key={value} className={`flex min-h-control cursor-pointer items-center gap-xs rounded-control border px-sm capitalize text-copy ${selected.includes(value) ? "border-border-strong bg-surface-2 text-foreground" : "border-border bg-bg text-body"}`}>
            <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} className="size-5 accent-current" />
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

