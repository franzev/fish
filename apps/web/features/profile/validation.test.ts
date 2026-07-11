import { describe, expect, it } from "vitest";
import { editProfileSchema } from "./validation";

describe("editProfileSchema", () => {
  it("rejects an empty displayName with the calm error message", () => {
    const result = editProfileSchema.safeParse({
      displayName: "",
      goal: "",
      locale: "en-US",
      timezone: "America/New_York",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const flattened = result.error.flatten().fieldErrors;
      expect(flattened.displayName?.[0]).toBe(
        "Add a name so your coach knows who they're talking to."
      );
    }
  });

  it("accepts a valid payload", () => {
    const result = editProfileSchema.safeParse({
      displayName: "Alex Rivera",
      goal: "Practice speaking in meetings",
      locale: "en-US",
      timezone: "America/New_York",
    });

    expect(result.success).toBe(true);
  });

  it("strips/ignores any level key (not in the schema, defense-in-depth)", () => {
    const result = editProfileSchema.safeParse({
      displayName: "Alex Rivera",
      goal: "",
      locale: "en-US",
      timezone: "America/New_York",
      level: "C2",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("level");
    }
  });

  it("trims displayName/goal/locale/timezone", () => {
    const result = editProfileSchema.safeParse({
      displayName: "  Alex Rivera  ",
      goal: "  Practice speaking  ",
      locale: "  en-US  ",
      timezone: "  America/New_York  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("Alex Rivera");
      expect(result.data.goal).toBe("Practice speaking");
      expect(result.data.locale).toBe("en-US");
      expect(result.data.timezone).toBe("America/New_York");
    }
  });
});
