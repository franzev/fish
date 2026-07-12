import { describe, expect, it, vi } from "vitest";
import { createProfileActionHandlers } from "./action-handlers";

describe("createProfileActionHandlers", () => {
  it("writes app-owned profile fields through focused injected ports", async () => {
    const updateDisplayName = vi.fn(async () => ({
      ok: true as const,
      data: undefined,
    }));
    const updateSafeFields = vi.fn(async () => ({
      ok: true as const,
      data: undefined,
    }));
    const redirect = vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const handlers = createProfileActionHandlers({
      auth: {
        getCurrentUser: async () => ({
          ok: true,
          data: { id: "client-1" },
        }),
      },
      profiles: {
        findById: async () => ({
          ok: true,
          data: {
            id: "client-1",
            displayName: "Alex Rivera",
            email: "alex@example.com",
            role: "client",
            avatarPath: null,
            avatarThumbnailPath: null,
            avatarUpdatedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
        updateDisplayName,
      },
      clientProfiles: { updateSafeFields },
      redirect,
    });
    const formData = new FormData();
    formData.set("displayName", "Alex Rivera");
    formData.set("goal", "Speak in meetings");
    formData.set("locale", "en-US");
    formData.set("timezone", "America/New_York");

    await expect(
      handlers.updateProfile(
        {
          values: {
            displayName: "",
            goal: "",
            locale: "",
            timezone: "",
          },
        },
        formData
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(updateDisplayName).toHaveBeenCalledWith(
      "client-1",
      "Alex Rivera"
    );
    expect(updateSafeFields).toHaveBeenCalledWith("client-1", {
      goal: "Speak in meetings",
      locale: "en-US",
      timezone: "America/New_York",
    });
  });
});
