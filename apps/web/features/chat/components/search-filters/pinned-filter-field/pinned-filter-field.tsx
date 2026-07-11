interface PinnedFilterFieldProps {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}

export function PinnedFilterField({ value, onChange }: PinnedFilterFieldProps) {
  return (
    <fieldset className="flex flex-col gap-xs">
      <legend className="font-sans text-heading-sm text-foreground">Pinned</legend>
      <p className="text-copy text-muted">If the message is pinned</p>
      <div className="grid grid-cols-3 gap-sm">
        {[
          { label: "Any", value: null },
          { label: "Pinned", value: true },
          { label: "Not pinned", value: false },
        ].map((option) => (
          <label key={option.label} className={`flex min-h-control cursor-pointer items-center gap-xs rounded-control border px-sm text-ui ${value === option.value ? "border-border-strong bg-surface-2 text-foreground" : "border-border bg-bg text-body"}`}>
            <input type="radio" name="pinned-filter" checked={value === option.value} onChange={() => onChange(option.value)} className="size-5 accent-current" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

