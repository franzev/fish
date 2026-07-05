import { describe, expect, it, vi } from "vitest";
import { createSupabaseServices } from "./core";
import type { AppSupabaseClient } from "./types";

function createQueryResult<T>(value: T) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: value, error: null })),
        single: vi.fn(async () => ({ data: value, error: null })),
      })),
    })),
  };
}

describe("Supabase service registry", () => {
  it("exposes cohesive auth, database, storage, and realtime services over one injected client", async () => {
    const profile = {
      id: "profile-1",
      role: "client",
      display_name: "Franz Fish",
      email: "franz@example.com",
      created_at: "2026-07-04T00:00:00Z",
      updated_at: "2026-07-04T00:00:00Z",
    };
    const bucket = { upload: vi.fn() };
    const channel = { subscribe: vi.fn() };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "profile-1", email: "franz@example.com" } },
          error: null,
        })),
        getClaims: vi.fn(async () => ({ data: { claims: {} }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      from: vi.fn(() => createQueryResult(profile)),
      storage: { from: vi.fn(() => bucket) },
      channel: vi.fn(() => channel),
    } as unknown as AppSupabaseClient;

    const services = createSupabaseServices(client);

    await expect(services.auth.getCurrentUser()).resolves.toMatchObject({
      ok: true,
      data: { id: "profile-1" },
    });
    await expect(services.auth.refreshSessionClaims()).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    await expect(services.database.profiles.findById("profile-1")).resolves.toEqual(
      { ok: true, data: profile }
    );
    expect(services.storage.from("avatars")).toBe(bucket);
    expect(services.realtime.channel("room:1")).toBe(channel);
    expect(services.client).toBe(client);
  });

  it("maps Supabase database failures into centralized service failures", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: { message: "permission denied", code: "42501" },
            })),
          })),
        })),
      })),
    } as unknown as AppSupabaseClient;

    const result = await createSupabaseServices(client).database.profiles.findById(
      "profile-1"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("database");
      expect(result.error.operation).toBe("profiles.findById");
      expect(result.error.details).toEqual({ supabaseCode: "42501" });
    }
  });

  it("treats a missing auth session as a signed-out user, not a service failure", async () => {
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: {
            name: "AuthSessionMissingError",
            message: "Auth session missing!",
            status: 400,
          },
        })),
      },
    } as unknown as AppSupabaseClient;

    await expect(
      createSupabaseServices(client).auth.getCurrentUser()
    ).resolves.toEqual({ ok: true, data: null });
  });

  it("treats a missing refresh token during session refresh as signed out", async () => {
    const client = {
      auth: {
        getClaims: vi.fn(async () => ({
          data: null,
          error: {
            name: "AuthApiError",
            message: "Invalid Refresh Token: Refresh Token Not Found",
            code: "refresh_token_not_found",
            status: 400,
          },
        })),
      },
    } as unknown as AppSupabaseClient;

    await expect(
      createSupabaseServices(client).auth.refreshSessionClaims()
    ).resolves.toEqual({ ok: true, data: undefined });
  });

  it("starts Google OAuth with the provided callback URL", async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: { provider: "google", url: "https://accounts.google.com" },
      error: null,
    }));
    const client = {
      auth: { signInWithOAuth },
    } as unknown as AppSupabaseClient;

    await expect(
      createSupabaseServices(client).auth.signInWithGoogle(
        "http://localhost:3001/auth/callback"
      )
    ).resolves.toEqual({ ok: true, data: undefined });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3001/auth/callback" },
    });
  });

  it("maps Google OAuth start failures into auth service failures", async () => {
    const client = {
      auth: {
        signInWithOAuth: vi.fn(async () => ({
          data: { provider: "google", url: null },
          error: { message: "provider unavailable", code: "provider_disabled" },
        })),
      },
    } as unknown as AppSupabaseClient;

    const result = await createSupabaseServices(client).auth.signInWithGoogle(
      "http://localhost:3001/auth/callback"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("auth");
      expect(result.error.operation).toBe("auth.signInWithGoogle");
      expect(result.error.details).toEqual({
        supabaseCode: "provider_disabled",
      });
    }
  });
});
