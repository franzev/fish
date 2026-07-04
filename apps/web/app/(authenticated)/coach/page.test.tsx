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

const { getCoachHomeDataMock } = vi.hoisted(() => ({
  getCoachHomeDataMock: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  getCoachHomeData: getCoachHomeDataMock,
}));

import CoachHomePage from "./page";

describe("CoachHomePage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getCoachHomeDataMock.mockReset();
  });

  it("silently forwards a client to /home (D-03 wrong door)", async () => {
    getCoachHomeDataMock.mockResolvedValueOnce({
      role: "client",
      clients: [],
    });

    await expect(CoachHomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/home");
  });

  it("renders ClientList with the coach's assigned clients (ROUT-03/ROUT-04)", async () => {
    getCoachHomeDataMock.mockResolvedValueOnce({
      role: "coach",
      clients: [
        {
          id: "1",
          displayName: "Alex Rivera",
          email: "alex@fish.dev",
        },
        {
          id: "2",
          displayName: "Priya Nair",
          email: "priya@fish.dev",
        },
        {
          id: "3",
          displayName: "Sam Okafor",
          email: "sam@fish.dev",
        },
      ],
    });

    const Page = await CoachHomePage();
    render(Page);

    expect(screen.getByText("Your clients")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("Sam Okafor")).toBeInTheDocument();
    expect(
      screen.queryByText("Clients assigned to you will show up here.")
    ).not.toBeInTheDocument();
  });

  it("renders the calm empty state when the coach has zero clients (SHEL-02)", async () => {
    getCoachHomeDataMock.mockResolvedValueOnce({ role: "coach", clients: [] });

    const Page = await CoachHomePage();
    render(Page);

    expect(screen.getByText("Your clients")).toBeInTheDocument();
    expect(
      screen.getByText("Clients assigned to you will show up here.")
    ).toBeInTheDocument();
  });

  it("queries coach_clients and does not hand-write a coach_id filter (RLS is the boundary)", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    expect(pageSource).toMatch(/getCoachHomeData/);
    expect(pageSource).not.toMatch(/\.eq\("coach_id"/);
  });
});
