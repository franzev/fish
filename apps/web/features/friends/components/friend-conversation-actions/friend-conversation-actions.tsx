"use client";

import { IconButton } from "@/components/ui/icon-button";
import type { FriendCommandService, FriendProfile } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { IconDots } from "@tabler/icons-react";
import { useState } from "react";
import { FriendSafetyActions } from "../friend-safety-actions";

interface FriendConversationActionsProps {
  friend: FriendProfile;
  className?: string;
  commands?: FriendCommandService;
  successHref?: string;
}

export function FriendConversationActions({
  friend,
  className,
  commands,
  successHref,
}: FriendConversationActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("inline-flex", className)}>
      <Popover.Root open={open} onOpenChange={setOpen} modal="trap-focus">
        <Popover.Trigger
          render={
            <IconButton
              label={`More actions for ${friend.displayName}`}
              appearance="ghost"
              className="hover:text-foreground"
              icon={<IconDots size={20} stroke={1.75} aria-hidden="true" />}
            />
          }
        />
        <Popover.Portal>
          <Popover.Backdrop className="fixed inset-0 z-40 hidden bg-scrim max-sm:block" />
          <Popover.Positioner side="bottom" align="end" className="z-50">
            <Popover.Popup
              aria-label="Friend actions"
              className="mt-2xs w-member-profile max-w-member-profile-mobile rounded-card border border-divider bg-surface p-md"
            >
              <FriendSafetyActions
                friend={friend}
                commands={commands}
                successHref={successHref}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
