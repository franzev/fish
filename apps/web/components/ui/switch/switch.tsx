import { cn } from "@/lib/utils";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { forwardRef } from "react";

export type SwitchProps = Omit<
  BaseSwitch.Root.Props,
  "children" | "className" | "nativeButton" | "onCheckedChange" | "render"
> & {
  className?: string;
  checked: boolean;
  onCheckedChange(checked: boolean): void;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, className, onCheckedChange, ...props }, ref) => (
    <BaseSwitch.Root
      {...props}
      ref={ref}
      render={<button type="button" />}
      nativeButton
      checked={checked}
      onCheckedChange={(nextChecked) => onCheckedChange(nextChecked)}
      data-slot="switch"
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
        <BaseSwitch.Thumb
          className={cn(
            "absolute left-2xs top-2xs size-md rounded-pill transition-transform",
            checked
              ? "translate-x-switch-travel bg-on-primary"
              : "bg-foreground"
          )}
        />
      </span>
    </BaseSwitch.Root>
  )
);
Switch.displayName = "Switch";
