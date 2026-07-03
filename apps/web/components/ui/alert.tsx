import { cn } from "@/lib/utils";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { HTMLAttributes } from "react";

type AlertTone = "notice" | "warning" | "error" | "success";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone: AlertTone;
  /** Calm, plain-verb copy. Never "Error:", never exclamation points. */
  children: React.ReactNode;
}

const toneConfig: Record<
  AlertTone,
  {
    Icon: typeof IconInfoCircle;
    className: string;
    iconClassName: string;
    messageClassName: string;
  }
> = {
  // Neutral/informational tier — stays monochrome (structural weight only).
  notice: {
    Icon: IconInfoCircle,
    className: "border-border-strong",
    iconClassName: "text-body",
    messageClassName: "font-normal",
  },
  warning: {
    Icon: IconAlertTriangle,
    className: "border-warning border-2",
    iconClassName: "text-warning",
    messageClassName: "font-semibold",
  },
  error: {
    Icon: IconAlertCircle,
    className: "border-error border-2",
    iconClassName: "text-error",
    messageClassName: "font-semibold",
  },
  success: {
    Icon: IconCircleCheck,
    className: "border-success border-2",
    iconClassName: "text-success",
    messageClassName: "font-normal",
  },
};

/** A block-level tone message. `notice` is the neutral informational tier
 *  and stays monochrome. `warning`/`error`/`success` are a deliberate D-08
 *  exception: each carries its own calm, desaturated hue (border + icon)
 *  on top of the icon-shape/weight distinction — a user decision so a
 *  floating result overlay reads at a glance, never a saturated color
 *  slab. Colors come from @theme tokens only (never raw hex here). */
export function Alert({ tone, children, className, ...props }: AlertProps) {
  const { Icon, className: toneClassName, iconClassName, messageClassName } =
    toneConfig[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-control border bg-surface p-4 shadow-[var(--shadow-card)]",
        toneClassName,
        className
      )}
      {...props}
    >
      <Icon
        size={20}
        stroke={tone === "notice" ? 1.75 : 2}
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0", iconClassName)}
      />
      <p className={cn("text-[15px] text-body", messageClassName)}>
        {children}
      </p>
    </div>
  );
}
