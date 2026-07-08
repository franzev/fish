import { render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/browser", () => ({
  signOut: vi.fn(async () => ({ ok: true, data: undefined })),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { generalChannelHref, generalChannelId } from "@/lib/channels";
import { AppShell } from "./app-shell";

let pathname = "/home";

describe("AppShell", () => {
  afterEach(() => {
    pathname = "/home";
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.textSize;
    delete document.documentElement.dataset.reducedMotion;
    delete document.documentElement.dataset.timeFormat;
  });

  it("renders the muted display name (D-09) and the logout button", () => {
    render(
      <AppShell displayName="Alex Rivera" role="client">
        Content
      </AppShell>
    );

    const names = screen.getAllByText("Alex Rivera");
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name.className.includes("text-muted"))).toBe(
      true
    );
    expect(screen.getAllByRole("button", { name: "Log out" }).length).toBeGreaterThan(0);
  });

  it("renders one centered content column with max-w-content and mx-auto (D-10)", () => {
    const { container } = render(
      <AppShell displayName="Alex Rivera" role="client">
        Content
      </AppShell>
    );

    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].className).toContain("max-w-content");
    expect(mains[0].className).toContain("mx-auto");
  });

  it("gives the chat route the full pane instead of the centered column", () => {
    pathname = "/chat";
    const { container } = render(
      <AppShell displayName="Alex Rivera" role="client">
        Content
      </AppShell>
    );

    const main = container.querySelector("main");
    expect(main?.className).not.toContain("max-w-content");
    expect(main?.className).toContain("min-h-0");
    // The shell locks to the viewport so only the message log scrolls.
    expect(container.firstElementChild?.className).toContain("h-dvh");
  });

  it("gives channel routes the full pane instead of the centered column", () => {
    pathname = `/channels/${generalChannelId}`;
    const { container } = render(
      <AppShell displayName="Alex Rivera" role="client">
        Content
      </AppShell>
    );

    const main = container.querySelector("main");
    expect(main?.className).not.toContain("max-w-content");
    expect(main?.className).toContain("min-h-0");
    // The shell locks to the viewport so only the message log scrolls.
    expect(container.firstElementChild?.className).toContain("h-dvh");
  });

  it("renders the channel column with the active # general link on channel routes", () => {
    pathname = `/channels/${generalChannelId}`;

    render(
      <AppShell displayName="Alex Rivera" role="client">
        Content
      </AppShell>
    );

    expect(
      screen.getByRole("heading", { name: "Community" })
    ).toBeInTheDocument();

    const channelNav = screen.getByRole("navigation", { name: "Channels" });
    const general = within(channelNav).getByRole("link", { name: "general" });
    expect(general).toHaveAttribute("href", generalChannelHref);
    expect(general).toHaveAttribute("aria-current", "page");
    expect(general).toHaveTextContent("# general");
  });

  it("does not render the channel column outside channel routes", () => {
    pathname = "/home";

    render(
      <AppShell displayName="Alex Rivera" role="client">
        Content
      </AppShell>
    );

    expect(
      screen.queryByRole("heading", { name: "Community" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Channels" })
    ).not.toBeInTheDocument();
  });

  it("hydrates persisted client preferences at the shell level", async () => {
    render(
      <AppShell
        displayName="Alex Rivera"
        role="client"
        preferences={{
          themePref: "dark",
          textSizePref: "larger",
          reducedMotionPref: true,
          timeFormatPref: "24h",
        }}
      >
        Content
      </AppShell>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.dataset.textSize).toBe("larger");
      expect(document.documentElement.dataset.reducedMotion).toBe("true");
      expect(document.documentElement.dataset.timeFormat).toBe("24h");
    });
  });

  it("D-09/SHEL-01: zero variant=\"primary\" across app-shell.tsx + logout-button.tsx, and variant=\"ghost\" is present", () => {
    const shellSource = readFileSync(resolve(__dirname, "./app-shell.tsx"), "utf-8");
    const logoutButtonSource = readFileSync(
      resolve(__dirname, "../auth/logout-button.tsx"),
      "utf-8"
    );
    const primaryMatches =
      (shellSource.match(/variant="primary"/g) ?? []).length +
      (logoutButtonSource.match(/variant="primary"/g) ?? []).length;
    expect(primaryMatches).toBe(0);
    expect(logoutButtonSource).toContain('variant="ghost"');
  });

  it("renders labeled client navigation without the unvalidated Progress tab", () => {
    pathname = "/channels/22222222-2222-4222-8222-222222222222";

    render(
      <AppShell displayName="Alex Rivera" role="client">
        Content
      </AppShell>
    );

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(primaryNav).toHaveTextContent("Home");
    expect(primaryNav).toHaveTextContent("Community");
    expect(primaryNav).toHaveTextContent("Profile");
    expect(primaryNav).not.toHaveTextContent("Progress");
    const community = within(primaryNav).getByRole("link", { name: "Community" });
    expect(community).toHaveAttribute(
      "href",
      "/channels/22222222-2222-4222-8222-222222222222"
    );
    expect(community).toHaveAttribute("aria-current", "page");
  });

  it("renders coach navigation to the roster instead of client profile choices", () => {
    pathname = "/coach";

    render(
      <AppShell displayName="Coach Dana" role="coach">
        Content
      </AppShell>
    );

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(primaryNav).toHaveTextContent("Clients");
    expect(primaryNav).toHaveTextContent("Community");
    expect(primaryNav).not.toHaveTextContent("Profile");
    expect(within(primaryNav).getByRole("link", { name: "Clients" })).toHaveAttribute(
      "href",
      "/coach"
    );
  });
});
