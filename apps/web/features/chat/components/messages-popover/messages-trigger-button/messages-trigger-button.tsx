import { CountBadge } from "@/components/ui/count-badge";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { IconMessages } from "@tabler/icons-react";
import { forwardRef } from "react";

interface MessagesTriggerButtonProps {
  label: string;
  unreadCount: number;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
  "aria-current"?: "page";
}

export const MessagesTriggerButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  MessagesTriggerButtonProps
>(function MessagesTriggerButton({
  label,
  unreadCount,
  active = false,
  href,
  onClick,
  className,
  "aria-current": ariaCurrent,
}, ref) {
  const icon = (
    <>
      <IconMessages size={20} stroke={1.75} aria-hidden="true" />
      <CountBadge
        count={unreadCount}
        className="absolute -right-3xs -top-3xs"
        aria-hidden="true"
      />
    </>
  );
  const sharedClassName = cn(
    "relative shrink-0 hover:bg-surface-2 hover:text-foreground",
    active && "bg-surface-2 text-foreground",
    className
  );
  if (href) {
    return (
      <IconButton
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        label={label}
        aria-current={ariaCurrent}
        appearance="ghost"
        className={sharedClassName}
        icon={icon}
      />
    );
  }
  return (
    <IconButton
      ref={ref as React.Ref<HTMLButtonElement>}
      label={label}
      aria-current={ariaCurrent}
      appearance="ghost"
      className={sharedClassName}
      onClick={onClick}
      icon={icon}
    />
  );
});
