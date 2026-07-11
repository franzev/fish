"use client";

import { Input, type InputProps } from "@/components/ui/input";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { forwardRef, useState } from "react";

export type PasswordInputProps = Omit<
  InputProps,
  "trailingControl" | "type"
>;

/** Password field with a stable, accessible reveal control. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (props, ref) => {
    const [visible, setVisible] = useState(false);
    const label = visible ? "Hide password" : "Show password";

    return (
      <Input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        trailingControl={
          <button
            type="button"
            aria-label={label}
            aria-pressed={visible}
            title={label}
            className="flex min-h-control min-w-control items-center justify-center rounded-control text-muted transition-colors hover:text-body"
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? (
              <IconEyeOff size={20} stroke={1.75} aria-hidden="true" />
            ) : (
              <IconEye size={20} stroke={1.75} aria-hidden="true" />
            )}
          </button>
        }
      />
    );
  }
);
PasswordInput.displayName = "PasswordInput";
