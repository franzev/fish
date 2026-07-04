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
  useRouter: () => ({ push: vi.fn() }),
}));

const getUserMock = vi.fn();
const singleMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({ select: () => ({ eq: () => ({ single: singleMock }) }) }),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

import AuthenticatedLayout from "./layout";

describe("AuthenticatedLayout", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getUserMock.mockReset();
    singleMock.mockReset();
  });

  it("calls redirect('/login') when getUser() returns no user (D-06 default-deny)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    await expect(AuthenticatedLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("calls redirect('/login') when getUser() returns a user but no profile row exists", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "ada@example.com" } },
    });
    singleMock.mockResolvedValueOnce({ data: null });

    await expect(AuthenticatedLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("resolves role + renders AppShell with the display name, no redirect, for a valid profile", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "ada@example.com" } },
    });
    singleMock.mockResolvedValueOnce({
      data: { role: "client", display_name: "Alex Rivera" },
    });

    const Layout = await AuthenticatedLayout({ children: <div>Content</div> });
    render(Layout);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
