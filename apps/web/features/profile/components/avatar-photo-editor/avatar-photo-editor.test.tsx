import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { AvatarPhotoEditor } from "./avatar-photo-editor";

describe("AvatarPhotoEditor", () => {
  it("keeps one primary choose action and a quiet removal action", () => {
    render(
      <AvatarPhotoEditor
        enabled
        userId="user-1"
        displayName="Alex Rivera"
        currentAvatarUrl={null}
        hasAvatar
      />
    );

    expect(screen.getByRole("heading", { name: "Profile photo" })).toBeVisible();
    expect(screen.getByText("Choose photo")).toHaveClass("bg-primary");
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
        displayName="Alex Rivera"
        currentAvatarUrl={null}
        hasAvatar={false}
      />
    );
    expect(screen.getByText(/resting for a moment/i)).toBeVisible();
    expect(screen.queryByText("Choose photo")).not.toBeInTheDocument();
  });
});
