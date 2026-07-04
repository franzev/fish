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

// Keyed-by-table mock: .from(table).select().eq().single() and .maybeSingle()
// both resolve from configurable per-table queues so each test can script the
// profiles read (role/display_name, then the coach's own display_name) and
// the coach_clients read independently.
const singleQueues: Record<string, unknown[]> = {};
const maybeSingleQueues: Record<string, unknown[]> = {};

function queueSingle(table: string, value: unknown) {
  singleQueues[table] = singleQueues[table] ?? [];
  singleQueues[table].push(value);
}

function queueMaybeSingle(table: string, value: unknown) {
  maybeSingleQueues[table] = maybeSingleQueues[table] ?? [];
  maybeSingleQueues[table].push(value);
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => (singleQueues[table] ?? []).shift(),
          maybeSingle: async () => (maybeSingleQueues[table] ?? []).shift(),
        }),
      }),
    }),
  }),
}));

import ClientHomePage from "./page";

describe("ClientHomePage", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getUserMock.mockClear();
    for (const key of Object.keys(singleQueues)) delete singleQueues[key];
    for (const key of Object.keys(maybeSingleQueues))
      delete maybeSingleQueues[key];
  });

  it("silently forwards a coach to /coach (D-03 wrong door)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "coach-1" } } });
    queueSingle("profiles", {
      data: { role: "coach", display_name: "Coach Dana" },
    });

    await expect(ClientHomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/coach");
  });

  it("renders the unassigned empty state and greeting when no coach is assigned (SHEL-02)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "client-1" } } });
    queueSingle("profiles", {
      data: { role: "client", display_name: "Alex Rivera" },
    });
    queueMaybeSingle("coach_clients", { data: null });

    const Page = await ClientHomePage();
    render(Page);

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(
      screen.getByText("We're getting things ready for you.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Coach Dana/)).not.toBeInTheDocument();
  });

  it("renders the assigned empty state naming the coach (D-16)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "client-1" } } });
    queueSingle("profiles", {
      data: { role: "client", display_name: "Alex Rivera" },
    });
    queueMaybeSingle("coach_clients", { data: { coach_id: "coach-1" } });
    queueSingle("profiles", { data: { display_name: "Coach Dana" } });

    const Page = await ClientHomePage();
    render(Page);

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(
      screen.getByText("Your coach Coach Dana is setting things up.")
    ).toBeInTheDocument();
  });

  it("carries zero variant=\"primary\" usage (grep gate, SHEL-01/D-18)", () => {
    const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = (pageSource.match(/variant="primary"/g) ?? []).length;
    expect(matches).toBe(0);
  });
});
