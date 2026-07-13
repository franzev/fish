import { describe, expect, it, vi, afterEach } from "vitest";

const { getServerServicesMock } = vi.hoisted(() => ({
  getServerServicesMock: vi.fn(),
}));

vi.mock("@/lib/services/runtime/server", () => ({
  getServerServices: getServerServicesMock,
}));

import { GET } from "./route";

function request(url: string): Parameters<typeof GET>[0] {
  return new Request(url) as Parameters<typeof GET>[0];
}

function createSupabaseClient({
  exchangeError = null,
  role = "client",
  userId = "user-1",
}: {
  exchangeError?: { message: string } | null;
  role?: "client" | "coach" | null;
  userId?: string | null;
} = {}) {
  return {
    auth: {
      exchangeCode: vi.fn(async () => exchangeError ? { ok: false, error: exchangeError } : { ok: true, data: undefined }),
      getCurrentUser: vi.fn(async () => ({ ok: true, data: userId ? { id: userId } : null })),
    },
    database: { profiles: { findRoleById: vi.fn(async () => ({ ok: true, data: role ? { role } : null })) } },
  };
}

describe("OAuth callback route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to sign-in without exchanging when the OAuth code is missing", async () => {
    const response = await GET(
      request("http://localhost:3001/auth/callback")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3001/sign-in");
    expect(getServerServicesMock).not.toHaveBeenCalled();
  });

  it("exchanges the code and routes client profiles to /home", async () => {
    const supabase = createSupabaseClient({ role: "client" });
    getServerServicesMock.mockResolvedValueOnce(supabase);

    const response = await GET(
      request("http://localhost:3001/auth/callback?code=abc")
    );

    expect(supabase.auth.exchangeCode).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("http://localhost:3001/home");
  });

  it("routes coach profiles to /coach", async () => {
    getServerServicesMock.mockResolvedValueOnce(
      createSupabaseClient({ role: "coach" })
    );

    const response = await GET(
      request("http://localhost:3001/auth/callback?code=abc")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3001/coach");
  });

  it("redirects to sign-in when the code exchange fails", async () => {
    getServerServicesMock.mockResolvedValueOnce(
      createSupabaseClient({ exchangeError: { message: "invalid code" } })
    );

    const response = await GET(
      request("http://localhost:3001/auth/callback?code=bad")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3001/sign-in");
  });
});
