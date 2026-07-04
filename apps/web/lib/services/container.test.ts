import { describe, expect, it } from "vitest";
import { createServiceContainer, extendServiceContainer } from "./container";

describe("service container", () => {
  it("freezes a named service map so consumers receive stable dependencies", () => {
    const supabase = { name: "supabase" };
    const container = createServiceContainer({ supabase });

    expect(container.supabase).toBe(supabase);
    expect(Object.isFrozen(container)).toBe(true);
  });

  it("extends a base container with future third-party services without mutating it", () => {
    const base = createServiceContainer({ supabase: { name: "supabase" } });
    const extended = extendServiceContainer(base, {
      analytics: { track: () => undefined },
    });

    expect("analytics" in base).toBe(false);
    expect(extended.supabase).toBe(base.supabase);
    expect(extended.analytics).toEqual({ track: expect.any(Function) });
    expect(Object.isFrozen(extended)).toBe(true);
  });
});
