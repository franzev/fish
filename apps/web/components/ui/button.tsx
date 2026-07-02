import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Full-width is the default — most ND screens have one big action. */
  fullWidth?: boolean;
  /** Busy state: dims, blocks pointer events, and shows a quiet spinner. */
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  // The ONE action on a screen. Use at most one primary per view.
  primary:
    "bg-primary text-on-primary hover:bg-primary-press active:bg-primary-press font-semibold",
  // A quieter alternative action when genuinely needed. Border width lives
  // in the base classes (constant across variants); only the color differs.
  secondary:
    "bg-surface text-foreground border-border hover:bg-surface-2",
  // Low-emphasis text actions ("Back", "Need help?").
  ghost:
    "bg-transparent text-muted hover:text-body",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      fullWidth = true,
      loading = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        aria-busy={loading || undefined}
        className={cn(
          // Layout stability: no state change may alter the rendered size.
          // relative anchors the loading overlay; a constant (transparent)
          // border keeps the box model identical across all variants.
          "relative inline-flex items-center justify-center rounded-control px-6",
          "min-h-[var(--size-control)] text-[17px] transition-colors",
          "border border-transparent",
          "disabled:opacity-50 disabled:pointer-events-none",
          fullWidth && "w-full",
          loading && "opacity-70 pointer-events-none",
          variants[variant],
          className
        )}
        {...props}
      >
        {loading && (
          // Overlaid, not inline: the hidden label below keeps the width, so
          // entering/leaving the loading state never resizes the button.
          // Animation is suppressed globally under prefers-reduced-motion.
          <span
            aria-hidden="true"
            className="absolute inset-0 m-auto size-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
          />
        )}
        <span className={cn(loading && "opacity-0")}>{children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";
