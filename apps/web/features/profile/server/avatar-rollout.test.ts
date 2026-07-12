import { afterEach, describe, expect, it } from "vitest";
import { avatarUploadsEnabled } from "./avatar-rollout";

describe("avatarUploadsEnabled", () => {
  const original = process.env.AVATAR_UPLOADS_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.AVATAR_UPLOADS_ENABLED;
    else process.env.AVATAR_UPLOADS_ENABLED = original;
  });

  it("requires an explicit true value", () => {
    delete process.env.AVATAR_UPLOADS_ENABLED;
    expect(avatarUploadsEnabled()).toBe(false);

    process.env.AVATAR_UPLOADS_ENABLED = "false";
    expect(avatarUploadsEnabled()).toBe(false);

    process.env.AVATAR_UPLOADS_ENABLED = "unexpected";
    expect(avatarUploadsEnabled()).toBe(false);

    process.env.AVATAR_UPLOADS_ENABLED = " TRUE ";
    expect(avatarUploadsEnabled()).toBe(true);
  });
});
