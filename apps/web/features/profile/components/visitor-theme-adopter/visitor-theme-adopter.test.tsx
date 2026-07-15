import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { adoptThemePreferenceActionMock } = vi.hoisted(() => ({
  adoptThemePreferenceActionMock: vi.fn(),
}));

vi.mock("@/features/profile/server/actions", () => ({
  adoptThemePreferenceAction: adoptThemePreferenceActionMock,
}));

import { VisitorThemeAdopter } from "./visitor-theme-adopter";

afterEach(() => {
  adoptThemePreferenceActionMock.mockReset();
  document.cookie = "fish-theme=; Path=/; Max-Age=0";
});

describe("VisitorThemeAdopter", () => {
  it("saves the visitor theme and clears its temporary cookie", async () => {
    document.cookie = "fish-theme=dark; Path=/";
    adoptThemePreferenceActionMock.mockResolvedValueOnce(true);

    render(<VisitorThemeAdopter theme="dark" />);

    await waitFor(() => {
      expect(adoptThemePreferenceActionMock).toHaveBeenCalledWith("dark");
      expect(document.cookie).not.toContain("fish-theme");
    });
  });

  it("keeps the cookie when the profile preference could not be saved", async () => {
    document.cookie = "fish-theme=light; Path=/";
    adoptThemePreferenceActionMock.mockResolvedValueOnce(false);

    render(<VisitorThemeAdopter theme="light" />);

    await waitFor(() => {
      expect(adoptThemePreferenceActionMock).toHaveBeenCalledWith("light");
    });
    expect(document.cookie).toContain("fish-theme=light");
  });
});
