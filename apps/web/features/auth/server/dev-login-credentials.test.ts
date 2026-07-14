import { describe, expect, it } from "vitest";
import { getDevLoginCredentials } from "./dev-login-credentials";

describe("getDevLoginCredentials", () => {
  it("returns the configured credentials outside production", () => {
    expect(
      getDevLoginCredentials({
        NODE_ENV: "development",
        DEV_LOGIN_EMAIL: " client1@fish.dev ",
        DEV_LOGIN_PASSWORD: "fish-client-dev",
      })
    ).toEqual({
      email: "client1@fish.dev",
      password: "fish-client-dev",
    });
  });

  it("does not expose configured credentials in production", () => {
    expect(
      getDevLoginCredentials({
        NODE_ENV: "production",
        DEV_LOGIN_EMAIL: "client1@fish.dev",
        DEV_LOGIN_PASSWORD: "fish-client-dev",
      })
    ).toBeUndefined();
  });

  it("does not partially prefill when either credential is missing", () => {
    expect(
      getDevLoginCredentials({
        NODE_ENV: "development",
        DEV_LOGIN_EMAIL: "client1@fish.dev",
      })
    ).toBeUndefined();
    expect(
      getDevLoginCredentials({
        NODE_ENV: "development",
        DEV_LOGIN_PASSWORD: "fish-client-dev",
      })
    ).toBeUndefined();
  });
});
