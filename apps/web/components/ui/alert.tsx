import { cn } from "@/lib/utils";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { HTMLAttributes } from "react";

type AlertTone = "notice" | "error" | "success";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone: AlertTone;
  /** Calm, plain-verb copy. Never "Error:", never exclamation points. */
  children: React.ReactNode;
}

const toneConfig: Record<
  AlertTone,
  { Icon: typeof IconInfoCircle; className: string; messageClassName: string }
> = {
  notice: {
    Icon: IconInfoCircle,
    className: "border-border-strong",
    messageClassName: "font-normal",
  },
  error: {
    Icon: IconAlertCircle,
    className: "border-error border-2",
    messageClassName: "font-semibold",
  },
  success: {
    Icon: IconCircleCheck,
    className: "border-border-strong",
    messageClassName: "font-normal",
  },
};

/** A block-level tone message. Tones are distinguished by icon shape,
 *  border weight, and message weight only — never by hue. */
export function Alert({ tone, children, className, ...props }: AlertProps) {
  const { Icon, className: toneClassName, messageClassName } = toneConfig[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-control border bg-surface p-4",
        toneClassName,
        className
      )}
      {...props}
    >
      <Icon
        size={20}
        stroke={tone === "error" ? 2 : 1.75}
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      />
      <p className={cn("text-[15px] text-body", messageClassName)}>
        {children}
      </p>
    </div>
  );
}
