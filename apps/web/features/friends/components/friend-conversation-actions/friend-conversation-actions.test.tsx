import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FriendCommandService } from "@/lib/services";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { FriendConversationActions } from "./friend-conversation-actions";

const friend = { id: "user-sam", displayName: "Sam Lee", username: "sam_lee" };

function makeCommands(): FriendCommandService {
  return {
    sendRequest: vi.fn(),
    respondRequest: vi.fn(),
    cancelRequest: vi.fn(),
    removeFriend: vi.fn(async () => ({ ok: true as const, data: undefined })),
    blockUser: vi.fn(async () => ({ ok: true as const, data: undefined })),
    unblockUser: vi.fn(),
    markNotificationsRead: vi.fn(),
  } as FriendCommandService;
}

describe("FriendConversationActions", () => {
  it("offers unfriend and block from the conversation header", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(
      <FriendConversationActions
        friend={friend}
        commands={commands}
        successHref="/messages"
      />
    );

    expect(screen.queryByRole("button", { name: "Unfriend" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Block @sam_lee" })
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "More actions for Sam Lee" })
    );

    expect(screen.getByRole("button", { name: "Unfriend" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Block @sam_lee" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Friendship")).toBeNull();
    expect(screen.queryByText("Sam Lee")).toBeNull();
    expect(screen.getByRole("button", { name: "Block @sam_lee" })).toHaveClass(
      "text-error"
    );
    expect(screen.getByRole("button", { name: "Unfriend" })).not.toHaveClass(
      "text-error"
    );

    fireEvent.click(screen.getByRole("button", { name: "Unfriend" }));
    expect(commands.removeFriend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Unfriend" }));

    await waitFor(() =>
      expect(commands.removeFriend).toHaveBeenCalledWith("user-sam")
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/messages"));
  });
});
