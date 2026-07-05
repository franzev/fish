import { afterEach, describe, expect, it, vi } from "vitest";

// Mock surface for getCoachClientDetailData: getCurrentProfile() reads
// auth.getCurrentUser() + profiles.findById(); the detail read then uses
// clientProfiles.findByIdForCoach() and profiles.findDisplayNameById().
const getCurrentUserMock = vi.fn();
const findProfileByIdMock = vi.fn();
const findByIdForCoachMock = vi.fn();
const findDisplayNameByIdMock = vi.fn();

vi.mock("@/lib/services/supabase/server", () => ({
  createServerSupabaseServices: async () => ({
    auth: { getCurrentUser: getCurrentUserMock },
    database: {
      profiles: {
        findById: findProfileByIdMock,
        findDisplayNameById: findDisplayNameByIdMock,
      },
      clientProfiles: { findByIdForCoach: findByIdForCoachMock },
    },
  }),
}));

import { getCoachClientDetailData } from "./server";

function signedInAsCoach() {
  getCurrentUserMock.mockResolvedValue({ ok: true, data: { id: "coach-1" } });
  findProfileByIdMock.mockResolvedValue({
    ok: true,
    data: { role: "coach", display_name: "Jamie Coach" },
  });
}

/* Regression: a `uuid` column rejects a non-UUID id with Postgres 22P02 (a
   THROW, not zero rows). Without the id guard, /coach/clients/not-a-uuid would
   surface a distinguishable 500 instead of the calm not-found — a UUID
   enumeration side channel and a broken not-found contract (T-04-02/D-11). */
describe("getCoachClientDetailData — uniform calm not-found (T-04-02)", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    findProfileByIdMock.mockReset();
    findByIdForCoachMock.mockReset();
    findDisplayNameByIdMock.mockReset();
  });

  it("returns the same not-found for a malformed (non-UUID) id and never queries the DB", async () => {
    signedInAsCoach();

    const result = await getCoachClientDetailData("not-a-uuid");

    expect(result).toEqual({ role: "coach", client: null });
    expect(findByIdForCoachMock).not.toHaveBeenCalled();
  });

  it("short-circuits numeric / injection-shaped ids to the same not-found", async () => {
    signedInAsCoach();

    for (const badId of ["1", "12345", "'; drop table client_profiles;--", "%00"]) {
      const result = await getCoachClientDetailData(badId);
      expect(result).toEqual({ role: "coach", client: null });
    }

    expect(findByIdForCoachMock).not.toHaveBeenCalled();
  });

  it("queries via RLS for a well-formed UUID and returns not-found (no name read) when RLS yields no row", async () => {
    signedInAsCoach();
    findByIdForCoachMock.mockResolvedValue({ ok: true, data: null });

    const uuid = "11111111-1111-1111-1111-111111111111";
    const result = await getCoachClientDetailData(uuid);

    expect(findByIdForCoachMock).toHaveBeenCalledWith(uuid);
    expect(result).toEqual({ role: "coach", client: null });
    // A null client-profile row means unassigned/unknown — the display-name
    // read must NOT happen (it would only run for a visible, assigned client).
    expect(findDisplayNameByIdMock).not.toHaveBeenCalled();
  });
});
