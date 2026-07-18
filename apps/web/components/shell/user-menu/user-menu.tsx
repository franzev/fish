"use client";

import { useSignOut } from "@/features/auth";
import {
  ActionMenuGroup,
  ActionMenuGroupLabel,
  ActionMenuItem,
  ActionMenuPopup,
  ActionMenuRoot,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import {
  PresenceAvatar,
  PresenceIndicator,
  useOwnPresence,
} from "@/features/presence";
import type {
  PresenceDurationSeconds,
  PresencePreference,
} from "@fish/core/presence";
import type { UserRole } from "@fish/core/roles";
import {
  IconChevronLeft,
  IconChevronRight,
  IconLogout,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
    label: "Do not disturb",
    detail: "Show others that you don’t want interruptions.",
    status: "busy",
  },
  {
    preference: "invisible",
    label: "Invisible",
    detail: "Appear offline.",
    status: "invisible",
  },
];

const durationOptions: ReadonlyArray<{
  label: string;
  seconds: PresenceDurationSeconds | null;
}> = [
  { label: "15 minutes", seconds: 900 },
  { label: "1 hour", seconds: 3_600 },
  { label: "8 hours", seconds: 28_800 },
  { label: "24 hours", seconds: 86_400 },
  { label: "3 days", seconds: 259_200 },
  { label: "Forever", seconds: null },
];

type StatusOption = (typeof statusOptions)[number];
type MenuView = "account" | "status" | "duration";

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
  const [menuView, setMenuView] = useState<MenuView>("account");
  const [pendingStatus, setPendingStatus] = useState<StatusOption | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstItemRef = useRef<HTMLDivElement | null>(null);
  const restoreTriggerFocusRef = useRef(false);
  const showFriends = role === "client" && friendsNavEnabled;

  useEffect(() => {
    if (menuOpen) firstItemRef.current?.focus();
  }, [menuOpen, menuView]);

  useEffect(() => {
    if (!menuOpen && restoreTriggerFocusRef.current) {
      restoreTriggerFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [menuOpen]);

  function applyStatus(
    preference: PresencePreference,
    durationSeconds: PresenceDurationSeconds | null
  ) {
    restoreTriggerFocusRef.current = true;
    setMenuView("account");
    setPendingStatus(null);
    setMenuOpen(false);
    void presence.setPreference(preference, durationSeconds);
  }

  function chooseDuration(
    durationSeconds: PresenceDurationSeconds | null
  ) {
    if (!pendingStatus) return;
    applyStatus(pendingStatus.preference, durationSeconds);
  }

  function chooseStatus(option: StatusOption) {
    if (option.preference === "automatic") {
      applyStatus("automatic", null);
      return;
    }
    openDuration(option);
  }

  function openDuration(option: StatusOption) {
    setPendingStatus(option);
    setMenuView("duration");
  }

  return (
    <ActionMenuRoot
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) {
          setMenuView("account");
          setPendingStatus(null);
        }
      }}
    >
      <ActionMenuTrigger
        ref={triggerRef}
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
      </ActionMenuTrigger>
      <ActionMenuPopup>
            {menuView === "duration" && pendingStatus ? (
              <>
                <ActionMenuItem
                  ref={firstItemRef}
                  closeOnClick={false}
                  onClick={() => setMenuView("status")}
                >
                  <IconChevronLeft size={18} stroke={1.75} aria-hidden="true" />
                  Back to status
                </ActionMenuItem>
                <ActionMenuGroup>
                  <ActionMenuGroupLabel className="block px-sm py-xs text-ui-sm text-body">
                    Show {pendingStatus.label.toLowerCase()} for:
                  </ActionMenuGroupLabel>
                  {durationOptions.map((duration) => (
                    <ActionMenuItem
                      key={duration.label}
                      closeOnClick={false}
                      disabled={presence.changing}
                      onClick={() => chooseDuration(duration.seconds)}
                    >
                      {duration.label}
                    </ActionMenuItem>
                  ))}
                </ActionMenuGroup>
                {presence.notice && <p className="px-sm py-2xs text-ui-sm text-notice">{presence.notice}</p>}
              </>
            ) : menuView === "status" ? (
              <>
                <ActionMenuItem
                  ref={firstItemRef}
                  closeOnClick={false}
                  onClick={() => setMenuView("account")}
                >
                  <IconChevronLeft size={18} stroke={1.75} aria-hidden="true" />
                  Back to account
                </ActionMenuItem>
                <ActionMenuGroup aria-label="Status">
                  {statusOptions.map((option) => (
                    <ActionMenuItem
                      key={option.preference}
                      closeOnClick={false}
                      disabled={presence.changing}
                      aria-current={presence.preference === option.preference ? "true" : undefined}
                      className="grid min-h-control cursor-pointer grid-cols-status-option items-center gap-sm rounded-control px-sm py-xs text-foreground aria-current:bg-surface-2 data-[disabled]:cursor-wait data-[disabled]:opacity-60 data-[highlighted]:bg-surface-2"
                      onClick={() => chooseStatus(option)}
                    >
                      <PresenceIndicator status={option.status} label={option.label} size={18} />
                      <span className="min-w-0">
                        <span className="block text-ui-sm">{option.label}</span>
                        <span className="block text-ui-xs text-body">{option.detail}</span>
                      </span>
                      <span className="flex items-center">
                        {option.preference !== "automatic" && (
                          <IconChevronRight size={18} stroke={1.75} aria-hidden="true" />
                        )}
                      </span>
                    </ActionMenuItem>
                  ))}
                </ActionMenuGroup>
                {presence.notice && <p className="px-sm py-2xs text-ui-sm text-notice">{presence.notice}</p>}
              </>
            ) : (
              <>
                <ActionMenuItem ref={firstItemRef} render={<Link href="/profile" />}>
                  <span className="action-menu-icon-slot" aria-hidden="true">
                    <IconUser size={20} stroke={1.75} />
                  </span>
                  Profile
                </ActionMenuItem>
                {showFriends && (
                  <ActionMenuItem render={<Link href="/friends" />}>
                    <span className="action-menu-icon-slot" aria-hidden="true">
                      <IconUsers size={20} stroke={1.75} />
                    </span>
                    Friends
                  </ActionMenuItem>
                )}
                <ActionMenuItem closeOnClick={false} onClick={() => setMenuView("status")}>
                  <span className="action-menu-icon-slot">
                    <PresenceIndicator status={presence.displayStatus} label={presence.displayLabel} size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-sm">
                    <span>Status</span>
                    <span className="truncate text-body">{presence.displayLabel}</span>
                  </span>
                  <IconChevronRight size={18} stroke={1.75} aria-hidden="true" />
                </ActionMenuItem>
                <ActionMenuItem onClick={signOut}>
                  <span className="action-menu-icon-slot" aria-hidden="true">
                    <IconLogout size={20} stroke={1.75} />
                  </span>
                  Sign out
                </ActionMenuItem>
                {notice && <p className="px-sm py-2xs text-ui-sm text-notice">{notice}</p>}
              </>
            )}
      </ActionMenuPopup>
    </ActionMenuRoot>
  );
}
