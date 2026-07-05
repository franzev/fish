"use client";

import { cn } from "@/lib/utils";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { TextareaHTMLAttributes, forwardRef, useId } from "react";

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  notice?: string;
  error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ className, label, hint, notice, error, id, disabled, ...props }, ref) => {
    const autoId = useId();
    const textareaId = id ?? autoId;
    const describedById = `${textareaId}-feedback`;

    return (
      <div className="w-full">
        <label
          htmlFor={textareaId}
          className="mb-2 block text-ui font-medium text-foreground"
        >
          {label}
        </label>
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          aria-describedby={describedById}
          className={cn(
            "w-full rounded-control bg-surface px-4 py-3",
            "min-h-control text-copy text-foreground",
            "border border-border placeholder:text-muted",
            "resize-y transition-colors focus:border-primary",
            "disabled:opacity-50",
            notice && !error && "border-border-strong",
            error && "border-error border-2",
            className
          )}
          {...props}
        />
        <div id={describedById} className="mt-1 min-h-field-message">
          {hint && !notice && !error && (
            <p className="text-ui-sm text-muted">{hint}</p>
          )}
          {!error && notice && (
            <p className="flex items-center gap-1.5 text-ui-sm text-notice">
              <IconInfoCircle
                size={20}
                stroke={1.75}
                aria-hidden="true"
                className="shrink-0"
              />
              {notice}
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-ui-sm font-semibold text-error">
              <IconAlertCircle
                size={20}
                stroke={2}
                aria-hidden="true"
                className="shrink-0"
              />
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }
);
TextAreaField.displayName = "TextAreaField";
