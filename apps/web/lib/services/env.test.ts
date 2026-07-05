import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPublicEnv, validatePublicEnv } from "./env";
import { ServiceConfigurationError } from "./errors";

describe("public service environment", () => {
  it("returns normalized Supabase public config when all values are valid", () => {
    const result = validatePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://fish.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        supabaseUrl: "https://fish.supabase.co",
        supabasePublishableKey: "publishable-key",
      },
    });
  });

  it("reports every missing public Supabase variable in one configuration error", () => {
    const result = validatePublicEnv({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ServiceConfigurationError);
      expect(result.error.code).toBe("configuration");
      expect(result.error.details).toEqual({
        missing: [
          "NEXT_PUBLIC_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        ],
      });
    }
  });

  it("rejects malformed Supabase URLs before a client is constructed", () => {
    const result = validatePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(result.error.details).toEqual({
        invalid: ["NEXT_PUBLIC_SUPABASE_URL"],
      });
    }
  });

  it("throws the centralized configuration error from getPublicEnv", () => {
    expect(() => getPublicEnv({})).toThrow(ServiceConfigurationError);
  });

  it("keeps browser defaults statically inlineable instead of reading process.env at runtime", () => {
    const source = readFileSync(resolve(__dirname, "./env.ts"), "utf-8");

    expect(source).toMatch(/NEXT_PUBLIC_SUPABASE_URL:\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
    expect(source).toMatch(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:\s*process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/
    );
    expect(source).not.toMatch(/=\s*process\.env[,\)]/);
  });
});
