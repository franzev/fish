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
  // A quieter alternative action when genuinely needed.
  secondary:
    "bg-surface text-foreground border border-border hover:bg-surface-2",
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
          "inline-flex items-center justify-center rounded-control px-6",
          "min-h-[var(--size-control)] text-[17px] transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none",
          fullWidth && "w-full",
          loading && "opacity-70 pointer-events-none",
          variants[variant],
          className
        )}
        {...props}
      >
        {loading && (
          // Animation is suppressed globally under prefers-reduced-motion.
          <span
            aria-hidden="true"
            className="mr-2 inline-block size-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
