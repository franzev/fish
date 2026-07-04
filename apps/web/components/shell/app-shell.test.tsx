import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/browser", () => ({
  signOut: vi.fn(async () => ({ ok: true, data: undefined })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders the muted display name (D-09) and the logout button", () => {
    render(<AppShell displayName="Alex Rivera">Content</AppShell>);

    const name = screen.getByText("Alex Rivera");
    expect(name.className).toContain("text-muted");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("renders one centered content column with max-w-[640px] and mx-auto (D-10)", () => {
    const { container } = render(
      <AppShell displayName="Alex Rivera">Content</AppShell>
    );

    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].className).toContain("max-w-[640px]");
    expect(mains[0].className).toContain("mx-auto");
  });

  it("D-09/SHEL-01: zero variant=\"primary\" across app-shell.tsx + logout-button.tsx, and variant=\"ghost\" is present", () => {
    const shellSource = readFileSync(resolve(__dirname, "./app-shell.tsx"), "utf-8");
    const logoutButtonSource = readFileSync(
      resolve(__dirname, "../auth/logout-button.tsx"),
      "utf-8"
    );
    const primaryMatches =
      (shellSource.match(/variant="primary"/g) ?? []).length +
      (logoutButtonSource.match(/variant="primary"/g) ?? []).length;
    expect(primaryMatches).toBe(0);
    expect(logoutButtonSource).toContain('variant="ghost"');
  });
});
