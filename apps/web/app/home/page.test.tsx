import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
const routerPushMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    // next/navigation's redirect() throws in real usage to halt rendering;
    // mirror that so the component body stops executing past the call.
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: routerPushMock }),
}));

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the heading, body, and exactly one primary Button when a user is present", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "ada@example.com" } },
    });

    const Page = await HomePage();
    render(Page);

    expect(screen.getByText("You're signed in")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This confirms your session — nothing else lives here yet."
      )
    ).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Log out");
  });

  it("calls redirect('/login') when getUser() returns no user", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("the page + its one client island together contain exactly one variant=\"primary\" usage (grep gate)", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const logoutButtonSource = readFileSync(
      resolve(__dirname, "../../components/auth/logout-button.tsx"),
      "utf-8"
    );
    const matches = (
      (pageSource.match(/variant="primary"/g) ?? []).length +
      (logoutButtonSource.match(/variant="primary"/g) ?? []).length
    );
    expect(matches).toBe(1);
  });
});
