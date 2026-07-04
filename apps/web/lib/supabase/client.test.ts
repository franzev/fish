import { afterEach, describe, expect, it, vi } from "vitest";

const { browserClient, createBrowserClientMock } = vi.hoisted(() => {
  const browserClient = { auth: { signOut: vi.fn() } };
  return {
    browserClient,
    createBrowserClientMock: vi.fn(() => browserClient),
  };
});

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

import { createClient } from "./client";

describe("browser Supabase compatibility helper", () => {
  afterEach(() => {
    createBrowserClientMock.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  it("keeps returning the raw typed browser client for existing Client Components", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fish.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    expect(createClient()).toBe(browserClient);
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      "https://fish.supabase.co",
      "publishable-key"
    );
  });
});
