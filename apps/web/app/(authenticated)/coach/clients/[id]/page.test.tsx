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

const { getCoachClientDetailDataMock } = vi.hoisted(() => ({
  getCoachClientDetailDataMock: vi.fn(),
}));
vi.mock("@/features/coach/server", () => ({
  getCoachClientDetailData: getCoachClientDetailDataMock,
}));
vi.mock("@/features/calls", () => ({
  CallEntryAction: ({ label }: { label: string }) => <button>{label}</button>,
}));

import CoachClientDetailPage from "./page";

describe("CoachClientDetailPage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getCoachClientDetailDataMock.mockReset();
  });

  it("redirects to signed-out when there is no session", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce(null);

    await expect(
      CoachClientDetailPage({ params: Promise.resolve({ id: "some-id" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("silently forwards a client to /home (wrong door)", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "client",
      client: null,
    });

    await expect(
      CoachClientDetailPage({ params: Promise.resolve({ id: "some-id" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/home");
  });

  it("renders the calm not-found notice when the client is unassigned/missing, never an error tone", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "coach",
      client: null,
    });

    const Page = await CoachClientDetailPage({
      params: Promise.resolve({ id: "guessed-uuid" }),
    });
    render(Page);

    expect(
      screen.getByText(/couldn.t find that client/i)
    ).toBeInTheDocument();
    // The calm Alert renders as border-only styling, no error/red tone --
    // assert no "error"/"couldn't be found" harsh copy leaked in.
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("renders identity + goal + level as a plain label, never a grade/percentage", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "coach",
      client: {
        id: "assigned-id",
        displayName: "Alex Rivera",
        goal: "Speak confidently in team meetings",
        level: "B1",
      },
    });
    const Page = await CoachClientDetailPage({
      params: Promise.resolve({ id: "assigned-id" }),
    });
    render(Page);

    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(
      screen.getByText("Speak confidently in team meetings")
    ).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    // Plain label, not a percentage/grade string.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/grade/i)).not.toBeInTheDocument();
  });

  it("hides private profile fields and exposes only the assigned call action", async () => {
    getCoachClientDetailDataMock.mockResolvedValueOnce({
      role: "coach",
      client: {
        id: "assigned-id",
        displayName: "Alex Rivera",
        goal: "Speak confidently in team meetings",
        level: "B1",
      },
    });
    const Page = await CoachClientDetailPage({
      params: Promise.resolve({ id: "assigned-id" }),
    });
    render(Page);

    expect(
      screen.getByRole("button", { name: "Call Alex Rivera" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/reduced motion/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/agreement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/consent/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score|grade|placement|recommendation|%/i)).not.toBeInTheDocument();
  });

  it("calls getCoachClientDetailData and does not hand-write an id/coach_id filter (RLS is the boundary)", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    expect(pageSource).toMatch(/getCoachClientDetailData/);
    expect(pageSource).not.toMatch(/getCoachClient.*ReviewData/);
    expect(pageSource).toMatch(/Alert tone="notice"/);
    expect(pageSource).not.toMatch(/\.eq\("coach_id"/);
    expect(pageSource).not.toMatch(/\.eq\("id"/);
  });
});
