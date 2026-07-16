import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface SettingsRowProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  /** The control or value shown on the trailing edge (a chevron, a toggle
   *  group, plain text, etc). */
  control?: React.ReactNode;
  /** Stack the label and control on mobile while preserving the trailing
   * desktop row used by account settings. */
  mobileStack?: boolean;
}

/** A touch-friendly row: label + trailing control. Reused for every settings row on
 *  /profile (Appearance, Reduced motion, Your agreement, Sign
 *  out) so the whole settings block reads as one consistent list, never a
 *  buffet of differently-shaped controls (sketch 003 winner A). */
export function SettingsRow({
  label,
  control,
  className,
  children,
  mobileStack = false,
  ...props
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-control items-center justify-between gap-md p-md",
        mobileStack && "max-md:flex-col max-md:items-stretch max-md:justify-start",
        className
      )}
      {...props}
    >
      <span className="text-foreground">{label}</span>
      {control}
      {children}
    </div>
  );
}
