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
vi.mock("@/lib/auth/server", () => ({
  getAuthenticatedShellProfile: getAuthenticatedShellProfileMock,
}));

vi.mock("@/lib/auth/browser", () => ({
  signOut: vi.fn(async () => ({ ok: true, data: undefined })),
}));

import AuthenticatedLayout from "./layout";

describe("AuthenticatedLayout", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getAuthenticatedShellProfileMock.mockReset();
  });

  it("calls redirect('/login') when getUser() returns no user (D-06 default-deny)", async () => {
    getAuthenticatedShellProfileMock.mockResolvedValueOnce(null);

    await expect(AuthenticatedLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("calls redirect('/login') when getUser() returns a user but no profile row exists", async () => {
    getAuthenticatedShellProfileMock.mockResolvedValueOnce(null);

    await expect(AuthenticatedLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("resolves role + renders AppShell with the display name, no redirect, for a valid profile", async () => {
    getAuthenticatedShellProfileMock.mockResolvedValueOnce({
      userId: "user-1",
      role: "client",
      displayName: "Alex Rivera",
    });

    const Layout = await AuthenticatedLayout({ children: <div>Content</div> });
    render(Layout);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getAllByText("Alex Rivera").length).toBeGreaterThan(0);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
