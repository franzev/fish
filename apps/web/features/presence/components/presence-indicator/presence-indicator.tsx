import { cn } from "@/lib/utils";
import {
  IconCircle,
  IconCircleFilled,
  IconCircleMinus,
  IconClock,
  IconEyeOff,
  IconMoonFilled,
} from "@tabler/icons-react";
import type { PresenceDisplayStatus } from "../../model/presentation";

export interface PresenceIndicatorProps {
  status: PresenceDisplayStatus;
  label?: string;
  className?: string;
  size?: number;
}

const icons = {
  online: IconCircleFilled,
  idle: IconMoonFilled,
  away: IconClock,
  busy: IconCircleMinus,
  invisible: IconEyeOff,
  offline: IconCircle,
};

const colors: Record<PresenceDisplayStatus, string> = {
  online: "text-presence-online",
  idle: "text-presence-idle",
  away: "text-presence-away",
  busy: "text-presence-busy",
  invisible: "text-presence-offline",
  offline: "text-presence-offline",
};

export function PresenceIndicator({
  status,
  label,
  className,
  size = 14,
}: PresenceIndicatorProps) {
  const Icon = icons[status];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", colors[status], className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Icon size={size} stroke={2.25} aria-hidden="true" />
    </span>
  );
}
