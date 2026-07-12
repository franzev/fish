import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FriendCommandService } from "@/lib/services";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { FriendSafetyActions } from "./friend-safety-actions";

const friend = { id: "user-sam", displayName: "Sam Lee", username: "sam_lee" };

function makeCommands(
  overrides: Partial<FriendCommandService> = {}
): FriendCommandService {
  return {
    sendRequest: vi.fn(),
    respondRequest: vi.fn(),
    cancelRequest: vi.fn(),
    removeFriend: vi.fn(async () => ({ ok: true as const, data: undefined })),
    blockUser: vi.fn(async () => ({ ok: true as const, data: undefined })),
    unblockUser: vi.fn(),
    markNotificationsRead: vi.fn(),
    ...overrides,
  } as FriendCommandService;
}

describe("FriendSafetyActions", () => {
  it("removes only after an inline confirmation", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(<FriendSafetyActions friend={friend} commands={commands} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove friend" }));
    expect(commands.removeFriend).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Remove Sam Lee from your friends\?/)
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove friend" }));

    await waitFor(() =>
      expect(commands.removeFriend).toHaveBeenCalledWith("user-sam")
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/friends"));
  });

  it("blocks after confirming, and explains no one is notified", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(<FriendSafetyActions friend={friend} commands={commands} />);

    fireEvent.click(screen.getByRole("button", { name: "Block @sam_lee" }));
    expect(screen.getByText(/they won’t be told/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Block" }));

    await waitFor(() =>
      expect(commands.blockUser).toHaveBeenCalledWith("user-sam")
    );
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/friends/blocked")
    );
  });

  it("lets the user step back out of the confirmation", () => {
    const commands = makeCommands();
    render(<FriendSafetyActions friend={friend} commands={commands} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove friend" }));
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(screen.getByRole("button", { name: "Remove friend" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Block @sam_lee" })).toBeVisible();
    expect(commands.removeFriend).not.toHaveBeenCalled();
    expect(commands.blockUser).not.toHaveBeenCalled();
  });
});
