import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const findProfileByIdMock = vi.fn();
const findClientProfileByIdMock = vi.fn();
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
      clientProfiles: {
        findById: findClientProfileByIdMock,
        findByIdForCoach: findByIdForCoachMock,
      },
    },
  }),
}));

import { getAuthenticatedShellProfile } from "@/features/auth/server";
import { getCoachClientDetailData } from "@/features/coach/server";

function signedInAsCoach() {
  getCurrentUserMock.mockResolvedValue({ ok: true, data: { id: "coach-1" } });
  findProfileByIdMock.mockResolvedValue({
    ok: true,
    data: { role: "coach", displayName: "Jamie Coach" },
  });
}

describe("getCoachClientDetailData — uniform calm not-found (T-04-02)", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    findProfileByIdMock.mockReset();
    findClientProfileByIdMock.mockReset();
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
    expect(findDisplayNameByIdMock).not.toHaveBeenCalled();
  });
});

describe("getAuthenticatedShellProfile — persisted preference hydration", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    findProfileByIdMock.mockReset();
    findClientProfileByIdMock.mockReset();
  });

  it("returns persisted client preferences for the authenticated shell", async () => {
    getCurrentUserMock.mockResolvedValue({ ok: true, data: { id: "client-1" } });
    findProfileByIdMock.mockResolvedValue({
      ok: true,
      data: { role: "client", displayName: "Alex Rivera" },
    });
    findClientProfileByIdMock.mockResolvedValue({
      ok: true,
      data: {
        themePref: "dark",
        textSizePref: "larger",
        reducedMotionPref: true,
        timeFormatPref: "24h",
      },
    });

    await expect(getAuthenticatedShellProfile()).resolves.toEqual({
      userId: "client-1",
      role: "client",
      displayName: "Alex Rivera",
      themePref: "dark",
      textSizePref: "larger",
      reducedMotionPref: true,
      timeFormatPref: "24h",
    });
    expect(findClientProfileByIdMock).toHaveBeenCalledWith("client-1");
  });

  it("does not look for client preference rows for coaches", async () => {
    getCurrentUserMock.mockResolvedValue({ ok: true, data: { id: "coach-1" } });
    findProfileByIdMock.mockResolvedValue({
      ok: true,
      data: { role: "coach", displayName: "Jamie Coach" },
    });

    await expect(getAuthenticatedShellProfile()).resolves.toMatchObject({
      userId: "coach-1",
      role: "coach",
      displayName: "Jamie Coach",
      themePref: null,
      textSizePref: "default",
      reducedMotionPref: null,
      timeFormatPref: null,
    });
    expect(findClientProfileByIdMock).not.toHaveBeenCalled();
  });
});
