import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/client/browser", () => ({
  signOut: vi.fn(async () => ({ ok: true, data: undefined })),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { generalChannelHref } from "@/lib/channels";
import { AppShell } from "./app-shell";

let pathname = "/home";

describe("AppShell", () => {
  afterEach(() => {
    pathname = "/home";
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.reducedMotion;
    delete document.documentElement.dataset.timeFormat;
  });

  it("renders an avatar-only account trigger, with Sign out reachable via the menu", () => {
    render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    const trigger = screen.getByRole("button", {
      name: "Account menu for Franz",
    });
    expect(within(trigger).queryByText("Franz")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
  });

  it("renders one centered content column with max-w-content and mx-auto (D-10)", () => {
    const { container } = render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].className).toContain("max-w-content");
    expect(mains[0].className).toContain("mx-auto");
  });

  it("gives channel routes the full pane instead of the centered column", () => {
    pathname = generalChannelHref;
    const { container } = render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    const main = container.querySelector("main");
    expect(main?.className).not.toContain("max-w-content");
    expect(main?.className).toContain("min-h-0");
    // The shell locks to the viewport so only the message log scrolls.
    expect(container.firstElementChild?.className).toContain("h-dvh");
  });

  it("gives booking its full focused pane without shell navigation", () => {
    pathname = "/book";
    const { container } = render(
      <AppShell displayName="Franz" role="client">
        Booking content
      </AppShell>
    );

    expect(container.querySelector("main")?.className).toContain("min-h-0");
    expect(container.querySelector("main")?.className).not.toContain("max-w-content");
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Mobile primary" })).not.toBeInTheDocument();
  });

  it("gives dedicated call routes a fullscreen pane without shell navigation", () => {
    pathname = "/calls/call-1";
    const { container } = render(
      <AppShell displayName="Franz" role="client">
        Call content
      </AppShell>
    );

    expect(container.querySelector("main")?.className).toContain("min-h-0");
    expect(container.querySelector("main")?.className).not.toContain("max-w-content");
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Mobile primary" })).not.toBeInTheDocument();
  });

  it("renders the channel column with the active room and the two focused community rooms", () => {
    pathname = generalChannelHref;

    render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    expect(
      screen.getByRole("heading", { name: "Channels" })
    ).toBeInTheDocument();

    const channelNav = screen.getByRole("navigation", { name: "Channels" });
    expect(within(channelNav).getAllByRole("link")).toHaveLength(15);
    const general = within(channelNav).getByRole("link", { name: "general" });
    expect(general).toHaveAttribute("href", generalChannelHref);
    expect(general).toHaveAttribute("aria-current", "page");
    expect(general).toHaveTextContent("# general");
    expect(
      within(channelNav).getByRole("link", { name: "introduce yourself" })
    ).toHaveAttribute("href", "/channels/introductions");
    expect(
      within(channelNav).getByRole("link", { name: "announcements" })
    ).toHaveAttribute("href", "/channels/announcements");
    expect(
      within(channelNav).getByRole("link", { name: "coworker culture" })
    ).toHaveAttribute("href", "/channels/coworker-culture");
  });

  it("does not render the channel column outside channel routes", () => {
    pathname = "/home";

    render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    expect(
      screen.queryByRole("heading", { name: "Channels" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Channels" })
    ).not.toBeInTheDocument();
  });

  it("hydrates persisted client preferences at the shell level", async () => {
    render(
      <AppShell
        displayName="Franz"
        role="client"
        preferences={{
          themePref: "dark",
          reducedMotionPref: true,
          timeFormatPref: "24h",
        }}
      >
        Content
      </AppShell>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.dataset.reducedMotion).toBe("true");
      expect(document.documentElement.dataset.timeFormat).toBe("24h");
    });
  });

  it("D-09/SHEL-01: zero variant=\"primary\" across app-shell.tsx + user-menu.tsx + sign-out-button.tsx, and variant=\"ghost\" is present", () => {
    const shellSource = readFileSync(resolve(__dirname, "./app-shell.tsx"), "utf-8");
    const userMenuSource = readFileSync(
      resolve(__dirname, "../user-menu/user-menu.tsx"),
      "utf-8"
    );
    const signOutButtonSource = readFileSync(
      resolve(
        __dirname,
        "../../../features/auth/components/sign-out-button/sign-out-button.tsx"
      ),
      "utf-8"
    );
    const primaryMatches =
      (shellSource.match(/variant="primary"/g) ?? []).length +
      (userMenuSource.match(/variant="primary"/g) ?? []).length +
      (signOutButtonSource.match(/variant="primary"/g) ?? []).length;
    expect(primaryMatches).toBe(0);
    expect(signOutButtonSource).toContain('variant="ghost"');
  });

  it("gives the logo link a centered accessible target (WR-09)", () => {
    render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    const logo = screen.getByRole("link", { name: "FISH home" });
    expect(logo.className).toContain("min-h-control");
    expect(logo.className).toContain("min-w-control");
    expect(logo.className).toContain("items-center");
    expect(logo.className).toContain("justify-center");
  });

  it("WR-09: app-shell.tsx source contains no stale /chat route reference", () => {
    const shellSource = readFileSync(resolve(__dirname, "./app-shell.tsx"), "utf-8");
    expect(shellSource).not.toMatch(/["']\/chat(?:\/|["'])/);
  });

  it("renders labeled client navigation without the unvalidated Progress tab", () => {
    pathname = generalChannelHref;

    render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    const mobilePrimaryNav = screen.getByRole("navigation", {
      name: "Mobile primary",
    });
    expect(primaryNav).toHaveTextContent("Home");
    expect(primaryNav).toHaveTextContent("Community");
    expect(primaryNav).not.toHaveTextContent("Messages");
    expect(mobilePrimaryNav).not.toHaveTextContent("Messages");
    expect(primaryNav).not.toHaveTextContent("Profile");
    expect(primaryNav).not.toHaveTextContent("Progress");
    const community = within(primaryNav).getByRole("link", { name: "Community" });
    expect(community).toHaveAttribute("href", "/channels/general");
    expect(community).toHaveAttribute("aria-current", "page");
  });

  it("keeps desktop nav geometry stable when a link becomes active or gains a count", () => {
    pathname = "/home";

    render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    const home = within(primaryNav).getByRole("link", { name: "Home" });
    const labelWidth = home.querySelector(".invisible");
    const badgeSlot = home.querySelector(".w-nav-badge-slot");

    expect(labelWidth).toHaveTextContent("Home");
    expect(labelWidth?.className).toContain("font-semibold");
    expect(badgeSlot).toBeInTheDocument();
    expect(badgeSlot?.className).toContain("shrink-0");
  });

  it("renders coach navigation to the roster instead of client profile choices", () => {
    pathname = "/coach";

    render(
      <AppShell displayName="Gwyn" role="coach">
        Content
      </AppShell>
    );

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(primaryNav).toHaveTextContent("Clients");
    expect(primaryNav).toHaveTextContent("Community");
    expect(screen.queryByRole("link", { name: "Messages" }))
      .not.toBeInTheDocument();
    expect(primaryNav).not.toHaveTextContent("Profile");
    expect(within(primaryNav).getByRole("link", { name: "Clients" })).toHaveAttribute(
      "href",
      "/coach"
    );
  });

  it("opens a menu with a Profile link to /profile for the client display name trigger", () => {
    render(
      <AppShell displayName="Franz" role="client">
        Content
      </AppShell>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Franz" })
    );

    const profileLink = screen.getByRole("menuitem", { name: "Profile" });
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  it("opens the shared Profile view for a coach", () => {
    render(
      <AppShell displayName="Gwyn" role="coach">
        Content
      </AppShell>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Gwyn" })
    );

    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" }))
      .toHaveAttribute("href", "/profile");
  });
});
