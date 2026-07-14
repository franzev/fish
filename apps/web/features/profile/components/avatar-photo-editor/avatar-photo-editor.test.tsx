import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/profile/hooks/use-avatar-upload", () => ({
  useAvatarUpload: () => ({
    status: "idle",
    progress: 0,
    notice: null,
    busy: false,
    markSelected: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock("@/features/profile/image/avatar-image", () => ({
  validateAvatarFile: vi.fn().mockResolvedValue({ width: 256, height: 256 }),
}));

vi.mock("react-easy-crop", () => ({
  default: ({ cropperProps }: { cropperProps: Record<string, string> }) => (
    <div {...cropperProps} />
  ),
}));

import { AvatarPhotoEditor } from "./avatar-photo-editor";

describe("AvatarPhotoEditor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps one primary choose action and a quiet removal action", () => {
    render(
      <AvatarPhotoEditor
        enabled
        userId="user-1"
        displayName="Franz"
        currentAvatarUrl={null}
        hasAvatar
      />
    );

    expect(screen.getByRole("heading", { name: "Profile photo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose photo" })).toHaveClass("bg-primary");
    expect(screen.getByLabelText("Choose profile photo")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp"
    );
    expect(screen.getByRole("button", { name: "Remove current photo" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to profile" })).toHaveAttribute("href", "/profile");
  });

  it("fails closed when the rollout switch is disabled", () => {
    render(
      <AvatarPhotoEditor
        enabled={false}
        userId="user-1"
        displayName="Franz"
        currentAvatarUrl={null}
        hasAvatar={false}
      />
    );
    expect(screen.getByText(/resting for a moment/i)).toBeVisible();
    expect(screen.queryByText("Choose photo")).not.toBeInTheDocument();
  });

  it("keeps the current crop when the replacement picker is cancelled", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:avatar");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(
      <AvatarPhotoEditor
        enabled
        userId="user-1"
        displayName="Franz"
        currentAvatarUrl={null}
        hasAvatar={false}
      />
    );

    fireEvent.change(screen.getByLabelText("Choose profile photo"), {
      target: {
        files: [new File(["png"], "avatar.png", { type: "image/png" })],
      },
    });
    expect(await screen.findByLabelText("Reposition profile photo")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Choose another photo" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Reposition profile photo")).toBeVisible()
    );
  });
});
