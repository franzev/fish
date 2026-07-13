import { describe, expect, it } from "vitest";
import { isGoogleAuthAvailable } from "./google-auth-availability";

describe("isGoogleAuthAvailable", () => {
  it("keeps Google auth hidden when both provider keys are missing", () => {
    expect(isGoogleAuthAvailable({})).toBe(false);
  });

  it("keeps Google auth hidden when the client ID is missing", () => {
    expect(
      isGoogleAuthAvailable({
        SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: "google-secret",
      })
    ).toBe(false);
  });

  it("keeps Google auth hidden when the secret is missing", () => {
    expect(
      isGoogleAuthAvailable({
        SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: "google-client-id",
      })
    ).toBe(false);
  });

  it("shows Google auth when both provider keys are present", () => {
    expect(
      isGoogleAuthAvailable({
        SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: " google-client-id ",
        SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: " google-secret ",
      })
    ).toBe(true);
  });
});
