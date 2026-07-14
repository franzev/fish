import { cn } from "@/lib/utils";
import {
  forwardRef,
  type ButtonHTMLAttributes,
} from "react";

export interface SwitchProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-checked" | "children" | "onClick" | "role"
  > {
  checked: boolean;
  onCheckedChange(checked: boolean): void;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, className, onCheckedChange, type = "button", ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type={type}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex min-h-control min-w-control items-center justify-center rounded-pill transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-lg w-control rounded-pill transition-colors",
          checked ? "bg-primary" : "bg-surface-3"
        )}
      >
        <span
          className={cn(
            "absolute left-2xs top-2xs size-md rounded-pill transition-transform",
            checked
              ? "translate-x-switch-travel bg-on-primary"
              : "bg-foreground"
          )}
        />
      </span>
    </button>
  )
);
Switch.displayName = "Switch";
