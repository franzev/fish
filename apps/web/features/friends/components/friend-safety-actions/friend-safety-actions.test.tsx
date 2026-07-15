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
  it("unfriends only after an inline confirmation", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(<FriendSafetyActions friend={friend} commands={commands} />);

    fireEvent.click(screen.getByRole("button", { name: "Unfriend" }));
    expect(commands.removeFriend).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Unfriend Sam Lee\?/)
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Unfriend" }));

    await waitFor(() =>
      expect(commands.removeFriend).toHaveBeenCalledWith("user-sam")
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/friends"));
  });

  it("blocks after confirming, and explains no one is notified", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(<FriendSafetyActions friend={friend} commands={commands} />);

    const blockAction = screen.getByRole("button", { name: "Block @sam_lee" });
    expect(blockAction).toHaveClass("text-error");
    fireEvent.click(blockAction);
    expect(screen.getByText(/they won’t be told/i)).toBeVisible();

    const confirmBlock = screen.getByRole("button", { name: "Block" });
    expect(confirmBlock).toHaveClass("text-error");
    fireEvent.click(confirmBlock);

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

    fireEvent.click(screen.getByRole("button", { name: "Unfriend" }));
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(screen.getByRole("button", { name: "Unfriend" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Block @sam_lee" })).toBeVisible();
    expect(commands.removeFriend).not.toHaveBeenCalled();
    expect(commands.blockUser).not.toHaveBeenCalled();
  });

  it("returns to a supplied surface after the friendship changes", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(
      <FriendSafetyActions
        friend={friend}
        commands={commands}
        successHref="/messages"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Unfriend" }));
    fireEvent.click(screen.getByRole("button", { name: "Unfriend" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/messages"));
  });

  it("returns to messages after blocking from a conversation", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(
      <FriendSafetyActions
        friend={friend}
        commands={commands}
        successHref="/messages"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Block @sam_lee" }));
    fireEvent.click(screen.getByRole("button", { name: "Block" }));

    await waitFor(() =>
      expect(commands.blockUser).toHaveBeenCalledWith("user-sam")
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/messages"));
  });
});
