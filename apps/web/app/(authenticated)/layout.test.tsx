import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    // next/navigation's redirect() throws in real usage to halt rendering;
    // mirror that so the component body stops executing past the call.
    throw new Error("NEXT_REDIRECT");
  },
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn() }),
}));

const { getAuthenticatedShellProfileMock } = vi.hoisted(() => ({
  getAuthenticatedShellProfileMock: vi.fn(),
}));
vi.mock("@/features/auth/server", () => ({
  getAuthenticatedShellProfile: getAuthenticatedShellProfileMock,
}));

vi.mock("@/features/auth/client/browser", () => ({
  signOut: vi.fn(async () => ({ ok: true, data: undefined })),
}));

vi.mock("@/features/calls", () => ({
  CallProvider: ({ children }: { children: React.ReactNode }) => children,
  CallPopover: () => <div data-testid="call-popover" />,
}));

vi.mock("@/features/notifications/server", () => ({
  getNotificationShellData: vi.fn(async () => ({
    page: { items: [], nextCursor: null },
    summary: { unreadCount: 0, unseenCount: 0, latestChangeSeq: 0 },
    attention: [],
  })),
}));

// ChatIdentityGuard (CR-01) now mounts alongside AppShell and calls this on
// mount -- mock it so the real Supabase browser client (and its required
// env vars) is never constructed in this unit test.
vi.mock("@/lib/services/runtime/browser", () => ({
  getBrowserServices: () => ({
    auth: { subscribe: () => () => {} },
    database: {
      notifications: {
        listPage: vi.fn(),
        getSummary: vi.fn(),
        listChanges: vi.fn(),
      },
      attention: { list: vi.fn() },
      presence: {
        listVisible: vi.fn(async () => ({ ok: true, data: [] })),
        getOwnPreference: vi.fn(async () => ({ ok: true, data: "automatic" })),
      },
    },
  }),
  getNotificationCommandService: () => ({ execute: vi.fn() }),
  getNotificationRealtimeService: () => ({ subscribe: () => () => {} }),
  getAttentionRealtimeService: () => ({ subscribe: () => () => {} }),
  getPresenceCommandService: () => ({ setMode: vi.fn() }),
  getPresenceRealtimeService: () => ({
    subscribe: () => () => {},
    startSession: () => ({ markActive: vi.fn(), stop: vi.fn() }),
  }),
}));

import AuthenticatedLayout from "./layout";

describe("AuthenticatedLayout", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getAuthenticatedShellProfileMock.mockReset();
  });

  it("calls redirect('/sign-in') when getUser() returns no user (D-06 default-deny)", async () => {
    getAuthenticatedShellProfileMock.mockResolvedValueOnce(null);

    await expect(AuthenticatedLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });

  it("calls redirect('/sign-in') when getUser() returns a user but no profile row exists", async () => {
    getAuthenticatedShellProfileMock.mockResolvedValueOnce(null);

    await expect(AuthenticatedLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });

  it("resolves role + renders an accessible avatar account trigger, no redirect, for a valid profile", async () => {
    getAuthenticatedShellProfileMock.mockResolvedValueOnce({
      userId: "user-1",
      role: "client",
      displayName: "Franz",
    });

    const Layout = await AuthenticatedLayout({ children: <div>Content</div> });
    render(Layout);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Account menu for Franz" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Franz")).not.toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByTestId("call-popover")).toBeInTheDocument();
  });
});
