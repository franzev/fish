import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { InputHTMLAttributes, ReactNode, forwardRef, useId } from "react";

export const inputVariants = cva(
  [
    "w-full rounded-control bg-surface px-md",
    "min-h-control text-copy text-foreground",
    "border border-border placeholder:text-muted",
    "transition-colors focus:border-primary",
    "disabled:opacity-50",
  ],
  {
    variants: {
      feedback: {
        default: null,
        notice: "border-border-strong",
        error: "border-error border-2",
      },
    },
    defaultVariants: {
      feedback: "default",
    },
  }
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Plain-language label, always shown above the field. */
  label: string;
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
      reserveMessageSpace = true,
      trailingControl,
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

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="mb-xs block text-ui font-medium text-foreground"
        >
          {label}
        </label>
        {trailingControl ? (
          <div className="relative">
            <input
              ref={ref}
              id={inputId}
              disabled={disabled}
              className={cn(
                inputVariants({ feedback }),
                "pr-control",
                className
              )}
              {...props}
              aria-describedby={describedBy}
            />
            <div className="absolute right-0 top-0 flex min-h-control min-w-control items-center justify-center">
              {trailingControl}
            </div>
          </div>
        ) : (
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              inputVariants({ feedback }),
              className
            )}
            {...props}
            aria-describedby={describedBy}
          />
        )}
        {shouldRenderMessageRow && (
          /* Reserved so showing/hiding a message can change text, not
             geometry, on forms that opt into that stability. Login opts out
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
