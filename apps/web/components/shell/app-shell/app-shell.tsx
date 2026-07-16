"use client";

import { PreferenceHydrator } from "@/components/shell/preference-hydrator";
import { UserMenu } from "@/components/shell/user-menu";
import { CountBadge } from "@/components/ui/count-badge";
import { MessagesPopover } from "@/features/chat";
import type { MessagePopoverActionState } from "@/features/chat/contracts";
import { NotificationBell } from "@/features/notifications";
import { useOptionalNotifications } from "@/features/notifications";
import { communityChannels, generalChannelHref } from "@/lib/channels";
import { cn } from "@/lib/utils";
import type { UserRole } from "@fish/core/roles";
import {
  IconHome,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ThemePref = "light" | "dark" | null;
type TimeFormatPref = "12h" | "24h" | null;

interface AppShellProps {
  displayName: string;
  avatarUrl?: string | null;
  profileId?: string;
  role: UserRole;
  /** Server-resolved pilot flag for the Friends entry in the account menu. */
  friendsNavEnabled?: boolean;
  loadMessagePopoverAction?: (
    input: unknown
  ) => Promise<MessagePopoverActionState>;
  preferences?: {
    themePref?: ThemePref;
    reducedMotionPref?: boolean | null;
    timeFormatPref?: TimeFormatPref;
  };
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  Icon: Icon;
}

interface AttentionBadgeValue {
  count: number;
  kind: "count" | "mention" | "activity";
}

function AttentionBadge({ value }: { value?: AttentionBadgeValue }) {
  if (!value || value.count <= 0) return null;
  if (value.kind === "activity") {
    return (
      <span className="size-2xs shrink-0 rounded-pill bg-foreground" title="New activity">
        <span className="sr-only">New activity</span>
      </span>
    );
  }
  const label = value.kind === "mention"
    ? `${value.count} ${value.count === 1 ? "mention" : "mentions"}`
    : `${value.count} new`;
  return (
    <CountBadge
      count={value.count}
      prefix={value.kind === "mention" ? "@" : ""}
      aria-label={label}
    />
  );
}

const clientNavItems: NavItem[] = [
  { href: "/home", label: "Home", Icon: IconHome },
  { href: generalChannelHref, label: "Community", Icon: IconUsersGroup },
];

const coachNavItems: NavItem[] = [
  { href: "/coach", label: "Clients", Icon: IconUsers },
  { href: generalChannelHref, label: "Community", Icon: IconUsersGroup },
];

function getNavItems(role: UserRole) {
  return role === "coach" ? coachNavItems : clientNavItems;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  items,
  pathname,
  placement,
}: {
  items: NavItem[];
  pathname: string;
  placement: "top" | "bottom";
}) {
  return (
    <>
      {items.map(({ href, label, Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-control items-center rounded-control text-ui-sm transition-colors",
              "text-muted hover:bg-surface-2 hover:text-foreground",
              active && "bg-surface-2 font-semibold text-foreground",
              placement === "top"
                ? "gap-2xs px-sm py-xs"
                : "flex-1 flex-col justify-center gap-2xs px-xs py-2xs"
            )}
          >
            <span
              className={cn(
                "rounded-pill",
                placement === "top" ? "px-2xs py-2xs" : "px-md py-2xs",
                placement === "bottom" && active && "bg-bg"
              )}
            >
              <Icon size={20} stroke={1.75} aria-hidden="true" />
            </span>
            <span className={placement === "top" ? "grid" : undefined}>
              {placement === "top" && (
                <span
                  aria-hidden="true"
                  className="invisible col-start-1 row-start-1 font-semibold"
                >
                  {label}
                </span>
              )}
              <span className={placement === "top" ? "col-start-1 row-start-1" : undefined}>
                {label}
              </span>
            </span>
          </Link>
        );
      })}
    </>
  );
}

/* Sketch 001/007: labeled navigation, top bar on wider web and bottom nav on
   mobile. Progress stays out until a coach validates that tracking technique.
   Account actions (Profile, Friends, Sign out) live behind the UserMenu trigger, so
   the shell adds no primary action. */
export function AppShell({
  displayName,
  avatarUrl,
  profileId,
  role,
  friendsNavEnabled = false,
  loadMessagePopoverAction,
  preferences,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const attention = useOptionalNotifications()?.attention ?? [];
  const navItems = getNavItems(role);
  const channelAttention = attention.filter((item) => item.surface === "channel");
  const directUnread = attention
    .filter((item) => item.surface === "direct")
    .reduce((total, item) => total + item.unreadCount, 0);
  const channelBadges = new Map(channelAttention.map((item) => [
    item.entityId,
    item.mentionCount > 0
      ? { count: item.mentionCount, kind: "mention" as const }
      : item.newActivity
      ? { count: 1, kind: "activity" as const }
      : undefined,
  ]));
  /* Conversation surfaces own the available pane and scroll internally.
     Accepted video calls use their dedicated route as a focused screen. */
  const channelSurface = isActivePath(pathname, "/channels");
  const messageSurface = isActivePath(pathname, "/messages");
  const bookingSurface = isActivePath(pathname, "/book");
  const callSurface = isActivePath(pathname, "/calls");
  const conversationSurface = channelSurface || messageSurface;
  const focusedSurface = bookingSurface || callSurface;
  const immersive = conversationSurface || focusedSurface;

  return (
    <div
      className={cn(
        "flex flex-col bg-bg",
        immersive ? "h-dvh" : "min-h-dvh"
      )}
    >
      <PreferenceHydrator
        themePref={preferences?.themePref}
        reducedMotionPref={preferences?.reducedMotionPref}
        timeFormatPref={preferences?.timeFormatPref}
      />

      {!focusedSurface && (
      <header className="flex shrink-0 items-center gap-md border-b border-divider bg-surface px-page py-md md:py-sm">
        <Link
          href={role === "coach" ? "/coach" : "/home"}
          aria-label="FISH home"
          className="inline-flex min-h-control min-w-control shrink-0 items-center justify-center"
        >
          <Image
            src="/icon.svg"
            alt="FISH"
            width={40}
            height={40}
          />
        </Link>
        <nav
          aria-label="Primary"
          className="hidden items-center gap-3xs md:flex"
        >
          <NavLinks items={navItems} pathname={pathname} placement="top" />
        </nav>
        <div className="flex-1" aria-hidden="true" />
        <div className="flex shrink-0 items-center gap-3xs">
          {role === "client" && (
            <MessagesPopover
              unreadCount={directUnread}
              active={messageSurface}
              loadPreviewAction={loadMessagePopoverAction}
            />
          )}
          <NotificationBell />
        </div>
        <UserMenu
          displayName={displayName}
          avatarUrl={avatarUrl}
          profileId={profileId}
          role={role}
          friendsNavEnabled={friendsNavEnabled}
        />
      </header>
      )}

      <main
        className={cn(
          "w-full flex-1",
          immersive
            ? "flex min-h-0 min-w-0"
            : "mobile-nav-content-safe mx-auto max-w-content px-page py-xl pb-mobile-nav-offset md:py-2xl md:pb-0"
        )}
      >
        {/* Keep channel navigation inside the immersive community surface so
            the rest of the product still presents one clear destination. */}
        {channelSurface && (
          <aside className="hidden w-channel-col shrink-0 flex-col overflow-y-auto border-r border-divider bg-surface px-2xs py-xs md:flex">
            <h2 className="px-2xs pb-2xs text-ui-2xs font-sans font-medium uppercase tracking-wide text-muted">
              Channels
            </h2>
            <nav aria-label="Channels" className="flex flex-col gap-3xs">
              {communityChannels.map((channel) => (
                <Link
                  key={channel.id}
                  href={channel.href}
                  aria-current={
                    isActivePath(pathname, channel.href) ? "page" : undefined
                  }
                  className={cn(
                    "flex items-center gap-2xs rounded-control px-xs py-2xs text-ui-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
                    isActivePath(pathname, channel.href) &&
                      "bg-surface-2 font-semibold text-foreground"
                  )}
                >
                  <span aria-hidden="true">#</span> {channel.name}
                  <span className="ml-auto"><AttentionBadge value={channelBadges.get(channel.id)} /></span>
                </Link>
              ))}
            </nav>
          </aside>
        )}

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            immersive && "min-h-0",
            conversationSurface &&
              "mobile-nav-content-safe pb-mobile-nav-offset md:pb-0"
          )}
        >
          {channelSurface && (
            <nav
              aria-label="Mobile channels"
              className="contain-horizontal-scroll w-full shrink-0 overflow-x-auto border-b border-divider bg-surface md:hidden"
            >
              <div className="flex w-max min-w-full gap-3xs px-page py-xs">
                {communityChannels.map((channel) => (
                  <Link
                    key={channel.id}
                    href={channel.href}
                    aria-current={
                      isActivePath(pathname, channel.href) ? "page" : undefined
                    }
                    className={cn(
                      "flex min-h-control shrink-0 items-center gap-2xs rounded-control px-sm text-ui-sm text-muted transition-colors",
                      "hover:bg-surface-2 hover:text-foreground",
                      isActivePath(pathname, channel.href) &&
                        "bg-surface-2 font-semibold text-foreground"
                    )}
                  >
                    <span aria-hidden="true">#</span> {channel.name}
                    <AttentionBadge value={channelBadges.get(channel.id)} />
                  </Link>
                ))}
              </div>
            </nav>
          )}
          {children}
        </div>
      </main>
      {!focusedSurface && (
        <nav
          aria-label="Mobile primary"
          className="mobile-nav-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-divider bg-surface px-xs pt-xs md:hidden"
        >
          <NavLinks items={navItems} pathname={pathname} placement="bottom" />
        </nav>
      )}
    </div>
  );
}
