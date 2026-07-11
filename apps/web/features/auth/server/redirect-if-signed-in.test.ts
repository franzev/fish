import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
}));

const getUserMock = vi.fn();
const singleQueues: Record<string, unknown[]> = {};

function queueSingle(table: string, value: unknown) {
  singleQueues[table] = singleQueues[table] ?? [];
  singleQueues[table].push(value);
}

vi.mock("@/lib/services/runtime/server", () => ({
  getServerServices: async () => ({
    auth: { getCurrentUser: async () => {
      const result = await getUserMock();
      return { ok: true, data: result.data.user };
    } },
    database: { profiles: { findRoleById: async () => {
      const result = (singleQueues.profiles ?? []).shift() as { data: unknown } | undefined;
      return { ok: true, data: result?.data ?? null };
    } } },
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
