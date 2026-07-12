"use client";

import { PreferenceHydrator } from "@/components/shell/preference-hydrator";
import { UserMenu } from "@/components/shell/user-menu";
import { generalChannelHref } from "@/lib/channels";
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
            <span>{label}</span>
          </Link>
        );
      })}
    </>
  );
}

/* Sketch 001/007: labeled navigation, top bar on wider web and bottom nav on
   mobile. Progress stays out until a coach validates that tracking technique.
   Account actions (Profile, Log out) live behind the UserMenu trigger, so
   the shell adds no primary action. */
export function AppShell({
  displayName,
  role,
  preferences,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role);
  /* Channels and calls are immersive surfaces: each owns the available pane
     and scrolls internally, so the shell locks to the viewport there. */
  const channelSurface = isActivePath(pathname, "/channels");
  const callSurface = isActivePath(pathname, "/calls");
  const immersive = channelSurface || callSurface;

  return (
    <div
      className={cn(
        "flex flex-col bg-bg",
        immersive ? "h-dvh" : "min-h-dvh"
      )}
    >
      <PreferenceHydrator
        themePref={preferences?.themePref}
        textSizePref={preferences?.textSizePref}
        reducedMotionPref={preferences?.reducedMotionPref}
        timeFormatPref={preferences?.timeFormatPref}
      />

      <header className="flex shrink-0 items-center gap-md border-b border-border bg-surface px-page py-md md:py-sm">
        <Link
          href={role === "coach" ? "/coach" : "/home"}
          aria-label="FISH home"
          className="inline-flex min-h-control min-w-control shrink-0 items-center justify-center"
        >
          <Image
            src="/logo.svg"
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
        <div className="hidden flex-1 md:block" aria-hidden="true" />
        <UserMenu displayName={displayName} role={role} />
      </header>

      <main
        className={cn(
          "w-full flex-1",
          immersive
            ? "flex min-h-0 min-w-0"
            : "mx-auto max-w-content px-page py-xl pb-mobile-nav-offset md:py-2xl"
        )}
      >
        {/* Single-channel milestone: the column lists only `# general`, so it
            appears just on the immersive channel surface where it orients
            the reader — never as a browsable menu on other screens. */}
        {channelSurface && (
          <aside className="hidden w-channel-col shrink-0 flex-col border-r border-border bg-surface px-sm py-page md:flex">
            <h2 className="px-xs pb-sm text-ui-2xs font-sans font-medium uppercase tracking-wide text-muted">
              Channels
            </h2>
            <nav aria-label="Channels" className="flex flex-col gap-3xs">
              <Link
                href={generalChannelHref}
                aria-current={
                  isActivePath(pathname, generalChannelHref)
                    ? "page"
                    : undefined
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

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            immersive && "min-h-0",
            channelSurface && "pb-mobile-nav-offset md:pb-0"
          )}
        >
          {children}
        </div>
      </main>
      {!callSurface && (
        <nav
          aria-label="Mobile primary"
          className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface px-xs py-xs md:hidden"
        >
          <NavLinks items={navItems} pathname={pathname} placement="bottom" />
        </nav>
      )}
    </div>
  );
}
