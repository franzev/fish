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
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.firstElementChild).toHaveClass("action-menu-icon-slot");
    }

    fireEvent.click(screen.getByRole("menuitem", { name: /Status/ }));
    expect(screen.getByRole("menuitem", { name: /Back to account/ }))
      .toHaveFocus();
    const currentStatus = screen.getByRole("menuitem", { name: /Online/ });
    expect(currentStatus).toHaveAttribute("aria-current", "true");
    expect(currentStatus).toHaveClass("aria-current:bg-surface-2");
    expect(screen.queryByLabelText("Selected")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Away/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Do not disturb/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Invisible/ }))
      .toBeInTheDocument();

    for (const status of ["Away", "Do not disturb", "Invisible"]) {
      fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(status) }));
      expect(screen.getByRole("menuitem", { name: "Back to status" }))
        .toHaveFocus();
      expect(screen.getByText(`Show ${status.toLowerCase()} for:`))
        .toBeInTheDocument();
      for (const duration of [
        "15 minutes",
        "1 hour",
        "8 hours",
        "24 hours",
        "3 days",
        "Forever",
      ]) {
        expect(screen.getByRole("menuitem", { name: duration }))
          .toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole("menuitem", { name: "Back to status" }));
    }
  });

  it("sets Online immediately without asking for a duration", async () => {
    render(<UserMenu displayName="Franz" role="client" />);

    const trigger = screen.getByRole("button", {
      name: "Account menu for Franz",
    });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: /Status/ }));

    const online = screen.getByRole("menuitem", { name: /Online/ });
    expect(online.querySelector(".tabler-icon-chevron-right")).toBeNull();
    fireEvent.click(online);

    expect(screen.queryByText("Show online for:")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "15 minutes" }))
      .not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes immediately when a duration is selected", async () => {
    render(<UserMenu displayName="Franz" role="client" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Franz" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Status/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Away/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "15 minutes" }));

    expect(screen.queryByRole("menuitem", { name: "15 minutes" }))
      .not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Account menu for Franz" }))
        .toHaveFocus();
    });
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
