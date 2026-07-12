"use client";

import { useLogout } from "@/features/auth";
import type { UserRole } from "@fish/core/roles";
import { Menu } from "@base-ui/react/menu";
import { IconLogout, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { Avatar } from "@/features/chat";

const menuItemClass =
  "flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2";

interface UserMenuProps {
  displayName: string;
  /** Kept for story/test compatibility; account profile access now exists for both roles. */
  role?: UserRole;
  avatarUrl?: string | null;
  profileId?: string;
}

/* Consolidates the header's account actions behind one quiet trigger — the
   display name — instead of a name link plus a standalone Log out button.
   D-09: the bar stays zero-primary; this menu adds no primary-styled Button.
   Log out routes through the shared useLogout hook so clearChatStore() (CR-01)
   always runs before the redirect, whether triggered here or from the
   Profile "Sign out" row. A failed sign-out (CR-01) never clears state or
   navigates -- it surfaces the hook's calm notice-tone guidance as a
   non-interactive row instead. Base UI Menu supplies roving focus,
   Escape/outside dismiss, and focus return for free. */
export function UserMenu({ displayName, avatarUrl, profileId }: UserMenuProps) {
  const { logout, notice } = useLogout();

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Account menu for ${displayName}`}
        className="flex min-h-control min-w-0 flex-1 items-center justify-end gap-2xs rounded-control px-2xs text-ui-sm text-muted hover:text-foreground md:max-w-56 md:flex-none"
      >
        <Avatar
          profileId={profileId}
          src={avatarUrl ?? undefined}
          name={displayName}
          size="sm"
          alt=""
        />
        <span className="truncate">{displayName}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-20">
          <Menu.Popup className="min-w-menu rounded-card border border-border bg-surface p-3xs shadow-popover">
            <Menu.Item
              className={menuItemClass}
              render={<Link href="/profile" />}
            >
              <IconUser size={20} stroke={1.75} aria-hidden="true" />
              Profile
            </Menu.Item>
            <Menu.Item className={menuItemClass} onClick={logout}>
              <IconLogout size={20} stroke={1.75} aria-hidden="true" />
              Log out
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
