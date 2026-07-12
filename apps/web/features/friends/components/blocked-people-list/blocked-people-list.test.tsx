import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FriendCommandService } from "@/lib/services";
import { BlockedPeopleList } from "./blocked-people-list";

const sam = { id: "user-sam", displayName: "Sam Lee", username: "sam_lee" };

function makeCommands(
  overrides: Partial<FriendCommandService> = {}
): FriendCommandService {
  return {
    sendRequest: vi.fn(),
    respondRequest: vi.fn(),
    cancelRequest: vi.fn(),
    removeFriend: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(async () => ({ ok: true as const, data: undefined })),
    markNotificationsRead: vi.fn(),
    ...overrides,
  } as FriendCommandService;
}

describe("BlockedPeopleList", () => {
  it("unblocks a person and confirms the reversible safety action", async () => {
    const commands = makeCommands();
    render(
      <BlockedPeopleList initialBlockedPeople={[sam]} commands={commands} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Unblock" }));

    await waitFor(() =>
      expect(commands.unblockUser).toHaveBeenCalledWith("user-sam")
    );
    expect(
      await screen.findByText("Sam Lee is no longer blocked.")
    ).toBeVisible();
    expect(screen.getByText("No one is blocked right now.")).toBeVisible();
  });

  it("keeps the person visible when unblocking does not go through", async () => {
    const commands = makeCommands({
      unblockUser: vi.fn(async () => ({
        ok: false as const,
        code: "friends_unavailable",
        notice: "That didn’t go through. Give it a moment and try again.",
      })),
    });
    render(
      <BlockedPeopleList initialBlockedPeople={[sam]} commands={commands} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Unblock" }));

    expect(
      await screen.findByText(
        "That didn’t go through. Give it a moment and try again."
      )
    ).toBeVisible();
    expect(screen.getByText("Sam Lee")).toBeVisible();
  });
});
