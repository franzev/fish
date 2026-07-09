"use client";

import { LogoutButton } from "@/components/auth/logout-button";
import { PreferenceHydrator } from "@/components/shell/preference-hydrator";
import { generalChannelHref } from "@/lib/channels";
import { cn } from "@/lib/utils";
import type { UserRole } from "@fish/core/roles";
import {
  IconHome,
  IconUser,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ThemePref = "light" | "dark" | null;
type TextSizePref = "default" | "large" | "larger" | null;
type TimeFormatPref = "12h" | "24h" | null;

interface AppShellProps {
  displayName: string;
  role: UserRole;
  preferences?: {
    themePref?: ThemePref;
    textSizePref?: TextSizePref;
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

const clientNavItems: NavItem[] = [
  { href: "/home", label: "Home", Icon: IconHome },
  { href: generalChannelHref, label: "Community", Icon: IconUsersGroup },
  { href: "/profile", label: "Profile", Icon: IconUser },
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
  placement: "rail" | "bottom";
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
              placement === "rail"
                ? "w-full flex-col justify-center gap-2xs px-xs py-xs"
                : "flex-1 flex-col justify-center gap-2xs px-xs py-2xs"
            )}
          >
            <span
              className={cn(
                "rounded-pill px-md py-2xs",
                placement === "bottom" && active && "bg-bg"
              )}
            >
              <Icon size={20} stroke={1.75} aria-hidden="true" />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </>
  );
}

/* Sketch 001/007: labeled navigation, rail on wider web and bottom nav on
   mobile. Progress stays out until a coach validates that tracking technique.
   Logout remains ghost, so the shell adds no primary action. */
export function AppShell({
  displayName,
  role,
  preferences,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role);
  /* Chat is the one immersive surface: the thread owns the pane edge-to-edge
     and scrolls internally, so the shell locks to the viewport here. Every
     other screen keeps the centered reading column (D-10). */
  const immersive =
    isActivePath(pathname, "/channels") || isActivePath(pathname, "/chat");

  return (
    <div className={cn("flex bg-bg", immersive ? "h-dvh" : "min-h-dvh")}>
      <PreferenceHydrator
        themePref={preferences?.themePref}
        textSizePref={preferences?.textSizePref}
        reducedMotionPref={preferences?.reducedMotionPref}
        timeFormatPref={preferences?.timeFormatPref}
      />
      <aside className="hidden w-24 shrink-0 flex-col items-center border-r border-border bg-surface px-sm py-page md:flex">
        <Image
          src="/logo.svg"
          alt="FISH"
          width={40}
          height={40}
          className="mb-lg rounded-control border-2 border-foreground"
        />
        <nav aria-label="Primary" className="flex w-full flex-col gap-xs">
          <NavLinks items={navItems} pathname={pathname} placement="rail" />
        </nav>
        <div className="flex flex-1" />
        <div className="flex w-full flex-col items-center gap-xs text-center">
          <span className="max-w-full truncate text-ui-xs text-muted">
            {displayName}
          </span>
          <LogoutButton className="w-full px-xs text-ui-sm" />
        </div>
      </aside>

      {/* Single-channel milestone: the column lists only `# general`, so it
          appears just on the immersive channel/chat surface where it orients
          the reader — never as a browsable menu on other screens. */}
      {immersive && (
        <aside className="hidden w-channel-col shrink-0 flex-col border-r border-border bg-surface px-sm py-page md:flex">
          <h2 className="px-xs pb-sm text-ui-2xs font-medium uppercase tracking-wide text-muted">
            Community
          </h2>
          <nav aria-label="Channels" className="flex flex-col gap-3xs">
            <Link
              href={generalChannelHref}
              aria-current={
                isActivePath(pathname, generalChannelHref) ? "page" : undefined
              }
              className={cn(
                "flex min-h-control items-center gap-2xs rounded-control px-sm text-ui-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
                isActivePath(pathname, generalChannelHref) &&
                  "bg-surface-2 font-semibold text-foreground"
              )}
            >
              <span aria-hidden="true">#</span> general
            </Link>
          </nav>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-page py-md md:hidden">
          <Image src="/logo.svg" alt="FISH" width={32} height={32} />
          <span className="min-w-0 truncate text-ui-sm text-muted">
            {displayName}
          </span>
          <LogoutButton />
        </header>
        <main
          className={cn(
            "w-full flex-1",
            immersive
              ? "flex min-h-0 flex-col pb-mobile-nav-offset md:pb-0"
              : "mx-auto max-w-content px-page py-xl pb-mobile-nav-offset md:py-2xl"
          )}
        >
          {children}
        </main>
        <nav
          aria-label="Mobile primary"
          className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface px-xs py-xs md:hidden"
        >
          <NavLinks items={navItems} pathname={pathname} placement="bottom" />
        </nav>
      </div>
    </div>
  );
}
