import { cn } from "@/lib/utils";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Plain-language label, always shown above the field. */
  label: string;
  /** Optional guidance. Calm and helpful, never scolding. */
  hint?: string;
  /** Tier 1 feedback — structural weight only, never a hue. Hidden if `error` is set. */
  notice?: string;
  /** Tier 2 feedback — heavier border + semibold message. Wins over `notice` if both are set. */
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, notice, error, id, disabled, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="mb-2 block text-[15px] font-medium text-foreground"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={cn(
            "w-full rounded-control bg-surface px-4",
            "min-h-[var(--size-control)] text-[17px] text-foreground",
            "border border-border placeholder:text-muted",
            "transition-colors focus:border-primary",
            "disabled:opacity-50",
            notice && !error && "border-border-strong",
            error && "border-error border-2",
            className
          )}
          {...props}
        />
        {/* Reserved so showing/hiding a message changes text, not geometry —
            Input's analogue of Button's overlay spinner. Always mounted at a
            constant min-height so hint/notice/error never resize the layout
            around this field. */}
        <div className="mt-2 min-h-[22px]">
          {hint && !notice && !error && (
            <p className="text-[14px] text-muted">{hint}</p>
          )}
          {!error && notice && (
            <p className="flex items-center gap-1.5 text-[14px] text-notice">
              <IconInfoCircle size={20} stroke={1.75} aria-hidden="true" className="shrink-0" />
              {notice}
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-error">
              <IconAlertCircle size={20} stroke={2} aria-hidden="true" className="shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }
);
Input.displayName = "Input";
