interface DayDividerProps {
  label: string;
}

export function DayDivider({ label }: DayDividerProps) {
  return (
    <li role="separator" className="mt-md flex items-center gap-xs">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span
        suppressHydrationWarning
        className="text-ui-2xs font-medium text-muted"
      >
        {label}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </li>
  );
}
