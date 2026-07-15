"use client";

import { Input, type InputProps } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
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
          <IconButton
            label={label}
            appearance="ghost"
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
            icon={visible ? (
              <IconEyeOff size={20} stroke={1.75} aria-hidden="true" />
            ) : (
              <IconEye size={20} stroke={1.75} aria-hidden="true" />
            )}
          />
        }
      />
    );
  }
);
PasswordInput.displayName = "PasswordInput";
