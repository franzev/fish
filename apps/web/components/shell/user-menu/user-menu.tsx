"use client";

import { useSignOut } from "@/features/auth";
import {
  PresenceAvatar,
  PresenceIndicator,
  useOwnPresence,
} from "@/features/presence";
import type { PresencePreference } from "@fish/core/presence";
import type { UserRole } from "@fish/core/roles";
import { Menu } from "@base-ui/react/menu";
import {
  IconCheck,
  IconChevronRight,
  IconLogout,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

const menuItemClass =
  "flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2";

const statusOptions: ReadonlyArray<{
  preference: PresencePreference;
  label: string;
  detail: string;
  status: "online" | "away" | "busy" | "invisible";
}> = [
  {
    preference: "automatic",
    label: "Online",
    detail: "Automatic while you use FISH.",
    status: "online",
  },
  {
    preference: "away",
    label: "Away",
    detail: "Show that you’re away.",
    status: "away",
  },
  {
    preference: "busy",
    label: "Busy",
    detail: "Show that replies may take longer.",
    status: "busy",
  },
  {
    preference: "invisible",
    label: "Invisible",
    detail: "Appear offline.",
    status: "invisible",
  },
];

interface UserMenuProps {
  displayName: string;
  role?: UserRole;
  friendsNavEnabled?: boolean;
  avatarUrl?: string | null;
  profileId?: string;
}

/* Consolidates the header's account actions behind one quiet trigger — the
   avatar — instead of a name link plus a standalone Sign out button.
   D-09: the bar stays zero-primary; this menu adds no primary-styled Button.
   Sign out routes through the shared useSignOut hook so clearChatStore() (CR-01)
   always runs before the redirect, whether triggered here or from the
   Profile "Sign out" row. A failed sign-out (CR-01) never clears state or
   navigates -- it surfaces the hook's calm notice-tone guidance as a
   non-interactive row instead. Base UI Menu supplies roving focus,
   Escape/outside dismiss, and focus return for free. */
export function UserMenu({
  displayName,
  role,
  friendsNavEnabled = false,
  avatarUrl,
  profileId,
}: UserMenuProps) {
  const { signOut, notice } = useSignOut();
  const presence = useOwnPresence();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const showFriends = role === "client" && friendsNavEnabled;

  async function chooseStatus(next: PresencePreference) {
    const changed = await presence.setPreference(next);
    if (changed) {
      setStatusOpen(false);
      setMenuOpen(false);
    }
  }

  return (
    <Menu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <Menu.Trigger
        aria-label={`Account menu for ${displayName}`}
        className="flex min-h-control min-w-control flex-none items-center justify-end rounded-control px-2xs md:max-w-control"
      >
        <PresenceAvatar
          profileId={profileId}
          src={avatarUrl ?? undefined}
          name={displayName}
          size="sm"
          alt=""
          status={presence.displayStatus}
          statusLabel={presence.displayLabel}
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-20">
          <Menu.Popup className="min-w-menu rounded-card border border-divider bg-surface p-3xs">
            <Menu.Item
              className={menuItemClass}
              render={<Link href="/profile" />}
            >
              <IconUser size={20} stroke={1.75} aria-hidden="true" />
              Profile
            </Menu.Item>
            {showFriends && (
              <Menu.Item
                className={menuItemClass}
                render={<Link href="/friends" />}
              >
                <IconUsers size={20} stroke={1.75} aria-hidden="true" />
                Friends
              </Menu.Item>
            )}
            <Menu.SubmenuRoot open={statusOpen} onOpenChange={setStatusOpen}>
              <Menu.SubmenuTrigger className={menuItemClass}>
                <PresenceIndicator
                  status={presence.displayStatus}
                  label={presence.displayLabel}
                  size={18}
                />
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-sm">
                  <span>Status</span>
                  <span className="truncate text-muted">
                    {presence.displayLabel}
                  </span>
                </span>
                <IconChevronRight size={18} stroke={1.75} aria-hidden="true" />
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner side="right" align="start" sideOffset={4} className="z-30">
                  <Menu.Popup className="min-w-menu rounded-card border border-divider bg-surface p-3xs">
                    <Menu.RadioGroup value={presence.preference}>
                      {statusOptions.map((option) => (
                        <Menu.RadioItem
                          key={option.preference}
                          value={option.preference}
                          closeOnClick={false}
                          disabled={presence.changing}
                          className="grid min-h-control cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-sm rounded-control px-sm py-xs text-foreground data-[disabled]:cursor-wait data-[disabled]:opacity-60 data-[highlighted]:bg-surface-2"
                          onClick={() => void chooseStatus(option.preference)}
                        >
                          <PresenceIndicator
                            status={option.status}
                            label={option.label}
                            size={18}
                          />
                          <span className="min-w-0">
                            <span className="block text-ui-sm">{option.label}</span>
                            <span className="block text-ui-xs text-muted">
                              {option.detail}
                            </span>
                          </span>
                          {presence.preference === option.preference && (
                            <IconCheck
                              size={18}
                              stroke={2}
                              aria-label="Selected"
                            />
                          )}
                        </Menu.RadioItem>
                      ))}
                    </Menu.RadioGroup>
                    {presence.notice && (
                      <p className="px-sm py-2xs text-ui-sm text-notice">
                        {presence.notice}
                      </p>
                    )}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
            <Menu.Item className={menuItemClass} onClick={signOut}>
              <IconLogout size={20} stroke={1.75} aria-hidden="true" />
              Sign out
            </Menu.Item>
            {notice && (
              <p className="px-sm py-2xs text-ui-sm text-notice">{notice}</p>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
