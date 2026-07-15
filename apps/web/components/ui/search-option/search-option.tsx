import { cn } from "@/lib/utils";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export interface SearchOptionProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  selected: boolean;
  children: ReactNode;
  selectedSurface?: "subtle" | "strong";
}

/** Shared listbox option for search suggestions and multi-select filters. */
export const SearchOption = forwardRef<HTMLButtonElement, SearchOptionProps>(
  function SearchOption(
    {
      selected,
      children,
      selectedSurface = "strong",
      className,
      type = "button",
      ...props
    },
    ref
  ) {
    const selectedClass = selectedSurface === "subtle"
      ? "bg-surface-2"
      : "bg-surface-3";
    const hoverClass = selectedSurface === "subtle"
      ? "hover:bg-surface-2"
      : "hover:bg-surface-3";

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        role="option"
        aria-selected={selected}
        className={cn(
          "flex min-h-control w-full items-center gap-sm rounded-control px-xs text-left disabled:cursor-not-allowed disabled:opacity-50",
          selected ? selectedClass : hoverClass,
          className
        )}
      >
        {children}
      </button>
    );
  }
);

SearchOption.displayName = "SearchOption";
