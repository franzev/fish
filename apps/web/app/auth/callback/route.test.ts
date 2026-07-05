import { describe, expect, it, vi, afterEach } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
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
      exchangeCodeForSession: vi.fn(async () => ({ error: exchangeError })),
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: role ? { role } : null,
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe("OAuth callback route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login without exchanging when the OAuth code is missing", async () => {
    const response = await GET(
      request("http://localhost:3001/auth/callback")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3001/login");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("exchanges the code and routes client profiles to /home", async () => {
    const supabase = createSupabaseClient({ role: "client" });
    createClientMock.mockResolvedValueOnce(supabase);

    const response = await GET(
      request("http://localhost:3001/auth/callback?code=abc")
    );

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("http://localhost:3001/home");
  });

  it("routes coach profiles to /coach", async () => {
    createClientMock.mockResolvedValueOnce(
      createSupabaseClient({ role: "coach" })
    );

    const response = await GET(
      request("http://localhost:3001/auth/callback?code=abc")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3001/coach");
  });

  it("redirects to login when the code exchange fails", async () => {
    createClientMock.mockResolvedValueOnce(
      createSupabaseClient({ exchangeError: { message: "invalid code" } })
    );

    const response = await GET(
      request("http://localhost:3001/auth/callback?code=bad")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3001/login");
  });
});
