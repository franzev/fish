import { describe, expect, it } from "vitest";
import { ServiceError } from "@/lib/services";
import {
  completeOAuthSignIn,
  getSignedInDestination,
} from "./auth-use-cases";

function dependencies(options: {
  exchangeOk?: boolean;
  userId?: string | null;
  role?: string | null;
}) {
  const auth = {
    exchangeCode: async () =>
      options.exchangeOk === false
        ? {
            ok: false as const,
            error: new ServiceError({ code: "auth", message: "invalid" }),
          }
        : { ok: true as const, data: undefined },
    getCurrentUser: async () => ({
      ok: true as const,
      data: options.userId ? { id: options.userId } : null,
    }),
  };
  const profiles = {
    findRoleById: async () => ({
      ok: true as const,
      data: options.role ? { role: options.role } : null,
    }),
  };
  return { auth, profiles };
}

describe("auth navigation use cases", () => {
  it("resolves role navigation through injected ports", async () => {
    await expect(
      getSignedInDestination(
        dependencies({ userId: "coach-1", role: "coach" })
      )
    ).resolves.toBe("/coach");
  });

  it("returns the signed-out destination when code exchange fails", async () => {
    await expect(
      completeOAuthSignIn(
        "bad-code",
        dependencies({ exchangeOk: false, userId: null, role: null })
      )
    ).resolves.toBe("/sign-in");
  });
});
