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
    <span className="relative inline-flex shrink-0 overflow-visible">
      <Avatar {...avatarProps} />
      <span className="absolute bottom-0 right-0 z-10 inline-flex rounded-pill bg-surface">
        <PresenceIndicator
          status={status}
          label={statusLabel}
          size={8}
        />
      </span>
    </span>
  );
}
