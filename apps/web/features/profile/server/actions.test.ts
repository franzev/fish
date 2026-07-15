import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    // next/navigation's redirect() throws in real usage to halt rendering;
    // mirror that so the action stops executing past the call.
    throw new Error("NEXT_REDIRECT");
  },
}));

const getCurrentUserMock = vi.fn();
const findProfileMock = vi.fn();
const updateDisplayNameMock = vi.fn();
const updateSafeFieldsMock = vi.fn();

vi.mock("@/lib/services/supabase/server", () => ({
  createServerSupabaseServices: async () => ({
    auth: { getCurrentUser: getCurrentUserMock },
    database: {
      profiles: {
        findById: findProfileMock,
        updateDisplayName: updateDisplayNameMock,
      },
      clientProfiles: { updateSafeFields: updateSafeFieldsMock },
    },
  }),
}));

import {
  acceptConsentAction,
  updatePrefsAction,
  updateProfileAction,
  type EditProfileState,
} from "./actions";

function formDataFrom(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

const validValues = {
  displayName: "Franz",
  goal: "Practice speaking in meetings",
  locale: "en-US",
  timezone: "America/New_York",
};

const prevState: EditProfileState = { values: validValues };

describe("updateProfileAction", () => {
  afterEach(() => {
    redirectMock.mockClear();
    getCurrentUserMock.mockReset();
    findProfileMock.mockReset();
    findProfileMock.mockResolvedValue({
      ok: true,
      data: { id: "client-1", role: "client" },
    });
    updateDisplayNameMock.mockReset();
    updateSafeFieldsMock.mockReset();
  });

  it("returns errors + the submitted values on an invalid displayName -- nothing is cleared (D-07)", async () => {
    getCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      data: { id: "client-1" },
    });

    const result = await updateProfileAction(
      prevState,
      formDataFrom({ ...validValues, displayName: "" })
    );

    expect(result.errors?.displayName?.[0]).toBe(
      "Add a name so your coach knows who they're talking to."
    );
    expect(result.values.goal).toBe("Practice speaking in meetings");
    expect(updateDisplayNameMock).not.toHaveBeenCalled();
    expect(updateSafeFieldsMock).not.toHaveBeenCalled();
  });

  it("calls the two-table write and redirects to /profile on a valid payload", async () => {
    getCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      data: { id: "client-1" },
    });
    updateDisplayNameMock.mockResolvedValueOnce({ ok: true, data: undefined });
    updateSafeFieldsMock.mockResolvedValueOnce({ ok: true, data: undefined });

    await expect(
      updateProfileAction(prevState, formDataFrom(validValues))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(updateDisplayNameMock).toHaveBeenCalledWith(
      "client-1",
      "Franz"
    );
    expect(updateSafeFieldsMock).toHaveBeenCalledWith(
      "client-1",
      expect.objectContaining({
        goal: "Practice speaking in meetings",
        locale: "en-US",
        timezone: "America/New_York",
      })
    );
    expect(redirectMock).toHaveBeenCalledWith("/profile");
  });

  it("returns a calm notice (never red/error tone) and preserves typed values on a write failure", async () => {
    getCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      data: { id: "client-1" },
    });
    updateDisplayNameMock.mockResolvedValueOnce({
      ok: false,
      error: { message: "db down" },
    });

    const result = await updateProfileAction(
      prevState,
      formDataFrom(validValues)
    );

    expect(result.notice).toBeTruthy();
    expect(result.notice?.toLowerCase()).not.toContain("error");
    expect(result.values).toEqual(validValues);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("re-verifies getUser() and does not trust the calling page (no session -> calm notice, no write)", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ ok: true, data: null });

    const result = await updateProfileAction(
      prevState,
      formDataFrom(validValues)
    );

    expect(result.notice).toBeTruthy();
    expect(updateDisplayNameMock).not.toHaveBeenCalled();
    expect(updateSafeFieldsMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("never references level in the write payload", () => {
    const source = readFileSync(resolve(__dirname, "./actions.ts"), "utf-8");
    expect(source).not.toMatch(/level/);
  });
});

describe("acceptConsentAction", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    updateSafeFieldsMock.mockReset();
  });

  it("records consent fields through the safe client profile write path (PROF-04)", async () => {
    getCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      data: { id: "client-1" },
    });
    updateSafeFieldsMock.mockResolvedValueOnce({ ok: true, data: undefined });

    await acceptConsentAction("2026-07");

    expect(updateSafeFieldsMock).toHaveBeenCalledWith(
      "client-1",
      expect.objectContaining({
        consented: true,
        consentVersion: "2026-07",
        consentedAt: expect.any(String),
      })
    );
    const [, fields] = updateSafeFieldsMock.mock.calls[0];
    expect(Number.isNaN(Date.parse(fields.consentedAt))).toBe(false);
  });

  it("does not write consent when the user is not signed in", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ ok: true, data: null });

    await acceptConsentAction("2026-07");

    expect(updateSafeFieldsMock).not.toHaveBeenCalled();
  });
});

describe("updatePrefsAction", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    updateSafeFieldsMock.mockReset();
  });

  it("persists profile preference fields through the safe path (PROF-03)", async () => {
    getCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      data: { id: "client-1" },
    });
    updateSafeFieldsMock.mockResolvedValueOnce({ ok: true, data: undefined });

    await updatePrefsAction({
      themePref: "dark",
      reducedMotionPref: true,
      timeFormatPref: "24h",
    });

    expect(updateSafeFieldsMock).toHaveBeenCalledWith("client-1", {
      themePref: "dark",
      reducedMotionPref: true,
      timeFormatPref: "24h",
    });
  });

  it("can persist system defaults as null without falling back to stale values", async () => {
    getCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      data: { id: "client-1" },
    });
    updateSafeFieldsMock.mockResolvedValueOnce({ ok: true, data: undefined });

    await updatePrefsAction({
      themePref: null,
      reducedMotionPref: null,
      timeFormatPref: null,
    });

    expect(updateSafeFieldsMock).toHaveBeenCalledWith("client-1", {
      themePref: null,
      reducedMotionPref: null,
      timeFormatPref: null,
    });
  });
});
