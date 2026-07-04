import { afterEach, describe, expect, it, vi } from "vitest";

const { cookieStore, createServerClientMock, serverClient } = vi.hoisted(() => {
  const serverClient = { auth: { getUser: vi.fn() } };
  return {
    serverClient,
    cookieStore: {
      getAll: vi.fn(() => [{ name: "sb", value: "token" }]),
      set: vi.fn(),
    },
    createServerClientMock: vi.fn(() => serverClient),
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { createClient } from "./server";

describe("server Supabase compatibility helper", () => {
  afterEach(() => {
    createServerClientMock.mockClear();
    cookieStore.getAll.mockClear();
    cookieStore.set.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  it("keeps returning the raw typed server client for Server Components and route handlers", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fish.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    await expect(createClient()).resolves.toBe(serverClient);
    expect(createServerClientMock).toHaveBeenCalledWith(
      "https://fish.supabase.co",
      "publishable-key",
      expect.objectContaining({ cookies: expect.any(Object) })
    );
  });
});
