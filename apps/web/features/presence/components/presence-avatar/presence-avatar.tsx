import { Avatar } from "@/features/chat";
import type { ComponentProps } from "react";
import type { PresenceDisplayStatus } from "../../model/presentation";
import { PresenceIndicator } from "../presence-indicator";

interface PresenceAvatarProps extends ComponentProps<typeof Avatar> {
  status: PresenceDisplayStatus;
  statusLabel: string;
}

export function PresenceAvatar({
  status,
  statusLabel,
  ...avatarProps
}: PresenceAvatarProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar {...avatarProps} />
      <span className="absolute -bottom-3xs -right-3xs inline-flex rounded-pill bg-surface p-3xs">
        <PresenceIndicator
          status={status}
          label={statusLabel}
          size={10}
        />
      </span>
    </span>
  );
}
