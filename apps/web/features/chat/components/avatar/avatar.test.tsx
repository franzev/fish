import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, avatarVariants } from "./avatar";

describe("Avatar", () => {
  it("exposes reusable CVA size variants for the maintained avatar styles", () => {
    // Default size is md.
    expect(avatarVariants()).toContain("bg-avatar");
    expect(avatarVariants()).toContain("size-10");
    expect(avatarVariants({ size: "xs" })).toContain("size-badge");
    expect(avatarVariants({ size: "sm" })).toContain("size-8");
    expect(avatarVariants({ size: "md" })).toContain("size-10");
    expect(avatarVariants({ size: "lg" })).toContain("size-14");
    expect(avatarVariants({ size: "profile" })).toContain(
      "size-profile-avatar"
    );
  });

  it("applies the requested size class to the rendered element", () => {
    const { container } = render(<Avatar name="Ada Lovelace" size="lg" />);
    expect((container.firstChild as HTMLElement).className).toContain("size-14");
  });

  it("defaults to md when no size is given", () => {
    const { container } = render(<Avatar name="Ada Lovelace" />);
    expect((container.firstChild as HTMLElement).className).toContain("size-10");
  });

  it("renders derived initials when a name is given and no image loads", () => {
    const { getByText } = render(<Avatar name="Ada Lovelace" />);
    expect(getByText("AL")).not.toBeNull();
  });
});
