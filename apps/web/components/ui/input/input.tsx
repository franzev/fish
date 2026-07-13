import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { InputHTMLAttributes, ReactNode, forwardRef, useId } from "react";

export const inputVariants = cva(
  [
    // A quiet surface-step well, not an outlined box — the same borderless
    // field idiom the chat composer uses. The constant (transparent) border
    // keeps the box stable when a feedback tier colors it in.
    "w-full rounded-control bg-surface-2",
    "text-foreground",
    "border border-transparent placeholder:text-muted",
    "transition-colors",
    "disabled:opacity-50",
  ],
  {
    variants: {
      density: {
        default: "min-h-control px-md text-copy",
        compact: "min-h-control px-sm text-ui-sm sm:min-h-search-control",
      },
      feedback: {
        default: null,
        notice: "border-border-strong",
        error: "border-error",
      },
    },
    defaultVariants: {
      density: "default",
      feedback: "default",
    },
  }
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Plain-language label, always shown above the field. */
  label: string;
  /** Keep the label available to assistive technology without displaying it. */
  labelVisuallyHidden?: boolean;
  /** Optional guidance. Calm and helpful, never scolding. */
  hint?: string;
  /** Tier 1 feedback — structural weight only, never a hue. Hidden if `error` is set. */
  notice?: string;
  /** Tier 2 feedback — heavier border + semibold message. Wins over `notice` if both are set. */
  error?: string;
  /** Preserve geometry for forms that expect inline feedback to appear. */
  reserveMessageSpace?: boolean;
  /** Optional in-field control, such as a password reveal button. */
  trailingControl?: ReactNode;
  /** Optional decorative icon shown at the start of the field. */
  leadingIcon?: ReactNode;
  /** Compact product-control density on desktop while preserving touch size on mobile. */
  density?: "default" | "compact";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      hint,
      notice,
      error,
      id,
      disabled,
      labelVisuallyHidden = false,
      reserveMessageSpace = true,
      trailingControl,
      leadingIcon,
      density = "default",
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const messageId = `${inputId}-message`;
    const feedback = error ? "error" : notice ? "notice" : "default";
    const hasMessage = Boolean(hint || notice || error);
    const describedBy = [
      props["aria-describedby"],
      hasMessage ? messageId : undefined,
    ].filter(Boolean).join(" ") || undefined;
    const shouldRenderMessageRow = reserveMessageSpace || hasMessage;
    const ariaInvalid = error ? true : props["aria-invalid"];

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className={cn(
            labelVisuallyHidden
              ? "sr-only"
              : "mb-xs block text-ui-sm font-medium text-foreground"
          )}
        >
          {label}
        </label>
        {leadingIcon || trailingControl ? (
          <div className="relative">
            <input
              ref={ref}
              id={inputId}
              disabled={disabled}
              className={cn(
                inputVariants({ feedback, density }),
                leadingIcon && (
                  density === "compact"
                    ? "pl-control sm:pl-search-control"
                    : "pl-control"
                ),
                trailingControl && (
                  density === "compact"
                    ? "pr-control sm:pr-search-control"
                    : "pr-control"
                ),
                className
              )}
              {...props}
              aria-describedby={describedBy}
              aria-invalid={ariaInvalid}
            />
            {leadingIcon && (
              <div className={cn(
                "pointer-events-none absolute left-0 top-0 flex min-h-control min-w-control items-center justify-center text-muted",
                density === "compact" && "sm:min-h-search-control sm:min-w-search-control"
              )}>
                {leadingIcon}
              </div>
            )}
            {trailingControl && (
              <div className={cn(
                "absolute right-0 top-0 flex min-h-control min-w-control items-center justify-center",
                density === "compact" && "sm:min-h-search-control sm:min-w-search-control"
              )}>
                {trailingControl}
              </div>
            )}
          </div>
        ) : (
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              inputVariants({ feedback, density }),
              className
            )}
            {...props}
            aria-describedby={describedBy}
            aria-invalid={ariaInvalid}
          />
        )}
        {shouldRenderMessageRow && (
          /* Reserved so showing/hiding a message can change text, not
             geometry, on forms that opt into that stability. Sign-in opts out
             when empty so it does not create dead air between fields. */
          <div
            className={cn(
              "mt-2xs",
              reserveMessageSpace && "min-h-field-message"
            )}
          >
            {hint && !notice && !error && (
              <p id={messageId} className="text-ui-sm text-muted">{hint}</p>
            )}
            {!error && notice && (
              <p id={messageId} className="flex items-center gap-nudge text-ui-sm text-notice">
                <IconInfoCircle size={20} stroke={1.75} aria-hidden="true" className="shrink-0" />
                {notice}
              </p>
            )}
            {error && (
              <p id={messageId} className="flex items-center gap-nudge text-ui-sm font-semibold text-error">
                <IconAlertCircle size={20} stroke={2} aria-hidden="true" className="shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
