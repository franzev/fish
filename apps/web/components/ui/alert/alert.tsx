import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { HTMLAttributes } from "react";

export const alertVariants = cva(
  "flex items-start gap-xs rounded-control border bg-surface p-md shadow-card",
  {
    variants: {
      tone: {
        // Neutral/informational tier — stays monochrome (structural weight only).
        notice: "border-border-strong",
        warning: "border-warning border-2",
        error: "border-error border-2",
        success: "border-success border-2",
      },
    },
  }
);

export const alertIconVariants = cva("mt-3xs shrink-0", {
  variants: {
    tone: {
      notice: "text-body",
      warning: "text-warning",
      error: "text-error",
      success: "text-success",
    },
  },
});

export const alertMessageVariants = cva("text-ui text-body", {
  variants: {
    tone: {
      notice: "font-normal",
      warning: "font-semibold",
      error: "font-semibold",
      success: "font-normal",
    },
  },
});

type AlertTone = NonNullable<VariantProps<typeof alertVariants>["tone"]>;

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone: AlertTone;
  /** Calm, plain-verb copy. Never "Error:", never exclamation points. */
  children: React.ReactNode;
}

const toneIcons: Record<AlertTone, typeof IconInfoCircle> = {
  notice: IconInfoCircle,
  warning: IconAlertTriangle,
  error: IconAlertCircle,
  success: IconCircleCheck,
};

/** A block-level tone message. `notice` is the neutral informational tier
 *  and stays monochrome. `warning`/`error`/`success` are a deliberate D-08
 *  exception: each carries its own calm, desaturated hue (border + icon)
 *  on top of the icon-shape/weight distinction — a user decision so a
 *  floating result overlay reads at a glance, never a saturated color
 *  slab. Colors come from @theme tokens only (never raw hex here). */
export function Alert({ tone, children, className, ...props }: AlertProps) {
  const Icon = toneIcons[tone];
  return (
    <div
      className={cn(
        alertVariants({ tone }),
        className
      )}
      {...props}
    >
      <Icon
        size={20}
        stroke={tone === "notice" ? 1.75 : 2}
        aria-hidden="true"
        className={cn(alertIconVariants({ tone }))}
      />
      <p className={cn(alertMessageVariants({ tone }))}>{children}</p>
    </div>
  );
}
