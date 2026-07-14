import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface MediaDeviceOption {
  id: string;
  label: string;
}

export interface MediaDeviceSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "onChange"> {
  label: string;
  options: readonly MediaDeviceOption[];
  onValueChange(value: string): void;
}

/** A consistent labeled device selector for pre-call and in-call settings. */
export const MediaDeviceSelect = forwardRef<
  HTMLSelectElement,
  MediaDeviceSelectProps
>(function MediaDeviceSelect(
  { label, options, onValueChange, className, ...selectProps },
  ref
) {
  return (
    <label className="flex w-full flex-col gap-xs text-left text-ui-sm text-body">
      {label}
      <select
        {...selectProps}
        ref={ref}
        className={cn(
          "min-h-control w-full rounded-control bg-surface-2 px-sm text-ui text-foreground",
          className
        )}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
});
