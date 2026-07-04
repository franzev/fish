import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    // next/navigation's redirect() throws in real usage to halt rendering;
    // mirror that so the caller stops executing past the call.
    throw new Error("NEXT_REDIRECT");
  },
}));

const getUserMock = vi.fn();

// Keyed-by-table mock: .from(table).select().eq().single() resolves from a
// configurable per-table queue so each test can script the profiles read.
const singleQueues: Record<string, unknown[]> = {};

function queueSingle(table: string, value: unknown) {
  singleQueues[table] = singleQueues[table] ?? [];
  singleQueues[table].push(value);
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => (singleQueues[table] ?? []).shift(),
        }),
      }),
    }),
  }),
}));

import { redirectIfSignedIn } from "./redirect-if-signed-in";

describe("redirectIfSignedIn", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getUserMock.mockClear();
    for (const key of Object.keys(singleQueues)) delete singleQueues[key];
  });

  it("redirects a signed-in client to /home", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "client-1" } } });
    queueSingle("profiles", { data: { role: "client" } });

    await expect(redirectIfSignedIn()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/home");
  });

  it("redirects a signed-in coach to /coach", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "coach-1" } } });
    queueSingle("profiles", { data: { role: "coach" } });

    await expect(redirectIfSignedIn()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/coach");
  });

  it("is a no-op for a signed-out visitor", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    await expect(redirectIfSignedIn()).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
