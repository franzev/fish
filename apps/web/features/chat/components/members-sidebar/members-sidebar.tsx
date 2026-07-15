"use client";

import { IconX } from "@tabler/icons-react";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatSearchMember } from "@/features/chat/model/search";
import { Avatar } from "../avatar";
import { MemberProfilePopover } from "../member-profile-popover";

interface MembersSidebarProps {
  members: ChatSearchMember[];
  currentUserId: string;
  currentUserRole: "client" | "coach";
  friendActionsEnabled?: boolean;
  onClose: () => void;
}

export function MembersSidebar({
  members,
  currentUserId,
  currentUserRole,
  friendActionsEnabled = false,
  onClose,
}: MembersSidebarProps) {
  return (
    <aside
      aria-label="Members"
      className="fixed inset-0 z-40 flex min-h-0 flex-col border-l border-divider bg-bg md:relative md:z-auto md:w-members-panel md:shrink-0"
    >
      <header className="flex min-h-chat-header items-center gap-xs bg-surface p-sm">
        <h2 className="min-w-0 flex-1 font-sans text-copy font-semibold text-foreground">
          {members.length} Members
        </h2>
        <IconButton
          label="Close members"
          appearance="ghost"
          onClick={onClose}
          className="shrink-0"
          icon={<IconX size={20} stroke={1.75} aria-hidden="true" />}
        />
      </header>

      <ScrollArea className="flex-1">
        {members.length === 0 ? (
          <div className="flex h-full items-center justify-center p-md text-center text-ui-sm text-body">
            No members are available yet.
          </div>
        ) : (
          <ul>
            {members.map((member) => (
              <li key={member.id}>
                <MemberProfilePopover
                  member={member}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  friendActionsEnabled={friendActionsEnabled}
                  trigger="custom"
                  className="w-full items-center gap-sm px-sm py-xs text-left hover:bg-surface-2"
                >
                  <Avatar
                    profileId={member.id}
                    src={member.avatarUrl}
                    name={member.displayName}
                    size="md"
                    alt=""
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-ui font-medium text-foreground">
                      {member.displayName}
                    </span>
                    <span className="block truncate text-ui-xs text-muted">
                      @{member.username}
                    </span>
                  </span>
                </MemberProfilePopover>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
