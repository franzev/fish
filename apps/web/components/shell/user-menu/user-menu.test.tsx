import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("opens on click and shows Profile + Sign out for a client", () => {
    render(<UserMenu displayName="Alex Rivera" role="client" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Alex Rivera" })
    );

    const profileLink = screen.getByRole("menuitem", { name: "Profile" });
    expect(profileLink).toHaveAttribute("href", "/profile");
    expect(
      screen.getByRole("menuitem", { name: "Sign out" })
    ).toBeInTheDocument();
  });

  it("shows Profile and Sign out for a coach", () => {
    render(<UserMenu displayName="Coach Dana" role="coach" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Coach Dana" })
    );

    expect(
      screen.getByRole("menuitem", { name: "Sign out" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" }))
      .toHaveAttribute("href", "/profile");
  });

  it("clicking Sign out signs out, clears the chat store, and pushes /sign-in (CR-01)", async () => {
    render(<UserMenu displayName="Alex Rivera" role="client" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Alex Rivera" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/sign-in"));
    expect(chatStore.getState()).toBeDefined();
  });
});
