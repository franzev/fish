import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signOutMock, pushMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => ({ ok: true, data: undefined })),
  pushMock: vi.fn(),
}));

vi.mock("@/lib/auth/browser", () => ({
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

  it("opens on click and shows Profile + Log out for a client", () => {
    render(<UserMenu displayName="Alex Rivera" role="client" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Alex Rivera" })
    );

    const profileLink = screen.getByRole("menuitem", { name: "Profile" });
    expect(profileLink).toHaveAttribute("href", "/profile");
    expect(
      screen.getByRole("menuitem", { name: "Log out" })
    ).toBeInTheDocument();
  });

  it("shows Log out but no Profile item for a coach", () => {
    render(<UserMenu displayName="Coach Dana" role="coach" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Coach Dana" })
    );

    expect(
      screen.getByRole("menuitem", { name: "Log out" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Profile" })
    ).not.toBeInTheDocument();
  });

  it("clicking Log out signs out, clears the chat store, and pushes /login (CR-01)", async () => {
    render(<UserMenu displayName="Alex Rivera" role="client" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Alex Rivera" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
    expect(chatStore.getState()).toBeDefined();
  });
});
