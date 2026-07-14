import { Input } from "@/components/ui/input";
import { IconSearch } from "@tabler/icons-react";
import { forwardRef, type ChangeEventHandler } from "react";

export interface MediaPickerSearchProps {
  id?: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  maxLength?: number;
}

/** Shared search control and outer inset for expressive-media pickers. */
export const MediaPickerSearch = forwardRef<
  HTMLInputElement,
  MediaPickerSearchProps
>(function MediaPickerSearch(
  {
    id,
    label,
    placeholder,
    value,
    onChange,
    maxLength = 50,
  },
  ref
) {
  return (
    <div className="shrink-0 p-xs" data-slot="media-picker-search">
      <Input
        ref={ref}
        id={id}
        type="search"
        label={label}
        labelVisuallyHidden
        reserveMessageSpace={false}
        density="compact"
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={onChange}
        leadingIcon={<IconSearch size={16} stroke={1.75} aria-hidden="true" />}
      />
    </div>
  );
});
