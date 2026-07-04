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

const getUserMock = vi.fn();

// Keyed-by-table mock: .from(table).select().eq().single() resolves the
// profiles role read; .from("coach_clients").select() (no .eq chain) resolves
// the coach's own-clients read directly, since the page trusts RLS instead of
// adding a manual .eq("coach_id", ...) filter.
const singleQueues: Record<string, unknown[]> = {};
const selectQueues: Record<string, unknown[]> = {};

function queueSingle(table: string, value: unknown) {
  singleQueues[table] = singleQueues[table] ?? [];
  singleQueues[table].push(value);
}

function queueSelect(table: string, value: unknown) {
  selectQueues[table] = selectQueues[table] ?? [];
  selectQueues[table].push(value);
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => ({
      select: (columns?: string) => {
        // The role read chains .eq().single(); the coach_clients read is
        // awaited directly (no .eq chain) since RLS is the boundary.
        if (columns === "role") {
          return {
            eq: () => ({
              single: async () => (singleQueues[table] ?? []).shift(),
            }),
          };
        }
        return Promise.resolve((selectQueues[table] ?? []).shift());
      },
    }),
  }),
}));

import CoachHomePage from "./page";

describe("CoachHomePage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getUserMock.mockClear();
    for (const key of Object.keys(singleQueues)) delete singleQueues[key];
    for (const key of Object.keys(selectQueues)) delete selectQueues[key];
  });

  it("silently forwards a client to /home (D-03 wrong door)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "client-1" } } });
    queueSingle("profiles", { data: { role: "client" } });

    await expect(CoachHomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/home");
  });

  it("renders ClientList with the coach's assigned clients (ROUT-03/ROUT-04)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "coach-1" } } });
    queueSingle("profiles", { data: { role: "coach" } });
    queueSelect("coach_clients", {
      data: [
        {
          client_id: "1",
          profiles: { id: "1", display_name: "Alex Rivera", email: "alex@fish.dev" },
        },
        {
          client_id: "2",
          profiles: { id: "2", display_name: "Priya Nair", email: "priya@fish.dev" },
        },
        {
          client_id: "3",
          profiles: { id: "3", display_name: "Sam Okafor", email: "sam@fish.dev" },
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
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "coach-1" } } });
    queueSingle("profiles", { data: { role: "coach" } });
    queueSelect("coach_clients", { data: [] });

    const Page = await CoachHomePage();
    render(Page);

    expect(screen.getByText("Your clients")).toBeInTheDocument();
    expect(
      screen.getByText("Clients assigned to you will show up here.")
    ).toBeInTheDocument();
  });

  it("queries coach_clients and does not hand-write a coach_id filter (RLS is the boundary)", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    expect(pageSource).toMatch(/coach_clients/);
    expect(pageSource).not.toMatch(/\.eq\("coach_id"/);
  });
});
