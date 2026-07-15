import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signOutMock, pushMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => ({ ok: true, data: undefined })),
  pushMock: vi.fn(),
}));

vi.mock("@/features/auth/client/browser", () => ({
  signOut: signOutMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({ push: pushMock }),
}));

import {
  chatStore,
  resetChatStoreForTests,
} from "@/features/chat/model/store";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetChatStoreForTests();
  });

  it("uses an avatar-only trigger and keeps status inside one submenu", () => {
    render(
      <UserMenu
        displayName="Franz"
        role="client"
        friendsNavEnabled
      />
    );

    const trigger = screen.getByRole("button", {
      name: "Account menu for Franz",
    });
    expect(within(trigger).queryByText("Franz")).not.toBeInTheDocument();
    fireEvent.click(trigger);

    const profileLink = screen.getByRole("menuitem", { name: "Profile" });
    expect(profileLink).toHaveAttribute("href", "/profile");
    const friendsLink = screen.getByRole("menuitem", { name: "Friends" });
    expect(friendsLink).toHaveAttribute("href", "/friends");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Profile",
      "Friends",
      "StatusOffline",
      "Sign out",
    ]);

    fireEvent.click(screen.getByRole("menuitem", { name: /Status/ }));
    expect(screen.getByRole("menuitemradio", { name: /Online/ }))
      .toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: /Away/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /Busy/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /Invisible/ }))
      .toBeInTheDocument();
  });

  it("closes immediately after choosing a status", () => {
    render(<UserMenu displayName="Franz" role="client" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Franz" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Status/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Away/ }));

    expect(screen.queryByRole("menuitemradio", { name: /Away/ }))
      .not.toBeInTheDocument();
  });

  it("shows Profile and Sign out, but not client-only Friends, for a coach", () => {
    render(
      <UserMenu displayName="Gwyn" role="coach" friendsNavEnabled />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Gwyn" })
    );

    expect(
      screen.getByRole("menuitem", { name: "Sign out" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" }))
      .toHaveAttribute("href", "/profile");
    expect(
      screen.queryByRole("menuitem", { name: "Friends" })
    ).not.toBeInTheDocument();
  });

  it("clicking Sign out signs out, clears the chat store, and pushes /sign-in (CR-01)", async () => {
    render(<UserMenu displayName="Franz" role="client" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Franz" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/sign-in"));
    expect(chatStore.getState()).toBeDefined();
  });
});
