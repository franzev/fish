interface PinnedFilterFieldProps {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}

export function PinnedFilterField({ value, onChange }: PinnedFilterFieldProps) {
  return (
    <fieldset className="flex flex-col gap-xs">
      <legend className="font-sans text-ui font-semibold text-foreground">Pinned</legend>
      <p className="text-ui-sm text-muted">If the message is pinned</p>
      <div className="grid grid-cols-3 gap-sm">
        {[
          { label: "Any", value: null },
          { label: "Pinned", value: true },
          { label: "Not pinned", value: false },
        ].map((option) => (
          <label key={option.label} className={`flex min-h-control cursor-pointer items-center gap-xs rounded-control px-sm text-ui ${value === option.value ? "bg-surface-3 text-foreground" : "bg-surface-2 text-body hover:bg-surface-3"}`}>
            <input type="radio" name="pinned-filter" checked={value === option.value} onChange={() => onChange(option.value)} className="size-5 accent-current" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

