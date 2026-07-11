import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    // next/navigation's redirect() throws in real usage to halt rendering;
    // mirror that so the component body stops executing past the call.
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: vi.fn() }),
}));

const { getClientHomeDataMock } = vi.hoisted(() => ({
  getClientHomeDataMock: vi.fn(),
}));
vi.mock("@/features/auth/server", () => ({
  getClientHomeData: getClientHomeDataMock,
}));

import ClientHomePage from "./page";

describe("ClientHomePage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getClientHomeDataMock.mockReset();
  });

  it("silently forwards a coach to /coach (D-03 wrong door)", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "coach",
      firstName: "Dana",
      coachName: null,
    });

    await expect(ClientHomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/coach");
  });

  it("renders the unassigned empty state and greeting when no coach is assigned (SHEL-02)", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachName: null,
    });

    const Page = await ClientHomePage();
    render(Page);

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(
      screen.getByText("We're getting things ready for you.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Coach Dana/)).not.toBeInTheDocument();
  });

  it("renders the assigned empty state naming the coach (D-16)", async () => {
    getClientHomeDataMock.mockResolvedValueOnce({
      role: "client",
      firstName: "Alex",
      coachName: "Coach Dana",
    });

    const Page = await ClientHomePage();
    render(Page);

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(
      screen.getByText("Your coach Coach Dana is setting things up.")
    ).toBeInTheDocument();
  });

  it("keeps the source free of primary actions and removed feature routes", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = (pageSource.match(/variant="primary"/g) ?? []).length;
    expect(matches).toBe(0);
    expect(pageSource).not.toMatch(/templates\.map|plans\.map/i);
  });
});
