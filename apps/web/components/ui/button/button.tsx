import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef, MouseEvent } from "react";

export const buttonVariants = cva(
  [
    // Layout stability: no state change may alter the rendered size.
    // relative anchors the loading overlay; a constant (transparent)
    // border keeps the box model identical across all variants.
    "relative inline-flex items-center justify-center rounded-control px-lg",
    "text-copy transition-colors",
    "border border-transparent cursor-pointer",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        // The ONE action on a screen. Use at most one primary per view.
        primary:
          "min-h-control-primary bg-primary text-on-primary hover:bg-primary-press active:bg-primary-press font-semibold",
        // A quieter alternative action when genuinely needed. Border width lives
        // in the base classes (constant across variants); only the color differs.
        secondary:
          "min-h-control bg-surface text-foreground border-border hover:bg-surface-2",
        // Low-emphasis text actions ("Back", "Need help?").
        ghost: "min-h-control bg-transparent text-muted hover:text-body",
      },
      fullWidth: {
        true: "w-full",
        false: null,
      },
      loading: {
        true: "opacity-70 cursor-progress",
        false: null,
      },
    },
    defaultVariants: {
      variant: "primary",
      fullWidth: false,
      loading: false,
    },
  }
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NonNullable<ButtonVariantProps["variant"]>;
  /** Opt into full-width when a focused flow needs one big action. */
  fullWidth?: boolean;
  /** Busy state: dims, guards its own click, and shows a quiet spinner. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      fullWidth = false,
      loading = false,
      disabled,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    // Non-activation, WHY: the native `disabled` attribute (passed through
    // via the prop below) blocks click AND keyboard for the disabled state.
    // Loading also disables native activation so submit buttons cannot fire
    // twice while the request is in flight. Neither state relies on
    // `pointer-events-none`; that class swallows the element's OWN cursor,
    // which is exactly what stopped cursor-progress/cursor-not-allowed from
    // ever rendering.
    //
    // The guard only matters when there is a consumer onClick to guard —
    // with none, the handler is a no-op and must not be attached at all.
    // Button renders inside Server Components with no onClick (e.g. the
    // / and /kit demo pages, including `<Button loading>` there), and
    // attaching any function prop in that case breaks RSC serialization
    // ("Event handlers cannot be passed to Client Component props") even
    // though Button itself is a client component.
    function handleClick(event: MouseEvent<HTMLButtonElement>) {
      if (loading) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    }

    return (
      <button
        ref={ref}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        onClick={onClick ? handleClick : undefined}
        className={cn(
          buttonVariants({ variant, fullWidth, loading }),
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
