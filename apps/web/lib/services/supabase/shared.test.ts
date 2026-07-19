import { describe, expect, it } from "vitest";
import { failWith } from "./shared";

describe("supabase service helpers", () => {
  it("composes a recoverable database failure with operation context", () => {
    const result = failWith("chat.load", "Could not load chat.")({
      code: "PGRST116",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.operation).toBe("chat.load");
      expect(result.error.recoverable).toBe(true);
      expect(result.error.message).toBe("Could not load chat.");
    }
  });
});
