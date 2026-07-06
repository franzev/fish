import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FieldConfig } from "@fish/core";

const getCurrentUserMock = vi.fn();
const getFieldForAnswerValidationMock = vi.fn();
const saveDraftMock = vi.fn();
const saveEntryMock = vi.fn();

vi.mock("@/lib/services/supabase/server", () => ({
  createServerSupabaseServices: async () => ({
    auth: { getCurrentUser: getCurrentUserMock },
    database: {
      tracker: {
        getFieldForAnswerValidation: getFieldForAnswerValidationMock,
        saveDraft: saveDraftMock,
        saveEntry: saveEntryMock,
      },
    },
  }),
}));

import { saveTrackerDraftAction, saveTrackerEntryAction } from "./actions";

const fieldId = "11111111-1111-4111-8111-111111111111";
const booleanConfig: FieldConfig = {
  type: "boolean",
  label: "Practice moment",
  options: [
    { id: "yes", label: "Yes" },
    { id: "not_today", label: "Not today" },
  ],
};

function mockSignedIn() {
  getCurrentUserMock.mockResolvedValueOnce({
    ok: true,
    data: { id: "client-1" },
  });
}

function mockField(config: FieldConfig = booleanConfig) {
  getFieldForAnswerValidationMock.mockResolvedValueOnce({
    ok: true,
    data: {
      id: fieldId,
      prompt: "Prompt",
      answerType: config.type,
      config,
      versionId: "version-1",
    },
  });
}

describe("tracker actions", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    getFieldForAnswerValidationMock.mockReset();
    saveDraftMock.mockReset();
    saveEntryMock.mockReset();
  });

  it("rejects malformed or caller-trusted fields before saving", async () => {
    mockSignedIn();

    const result = await saveTrackerEntryAction({
      fieldId,
      clientId: "22222222-2222-4222-8222-222222222222",
      answer: { type: "boolean", value: true },
    });

    expect(result.status).toBe("notice");
    expect(getFieldForAnswerValidationMock).not.toHaveBeenCalled();
    expect(saveEntryMock).not.toHaveBeenCalled();
  });

  it("rejects an answer that does not fit the loaded field config", async () => {
    mockSignedIn();
    mockField();

    const result = await saveTrackerEntryAction({
      fieldId,
      answer: { type: "boolean", value: "yes" },
    });

    expect(result.status).toBe("notice");
    expect(saveEntryMock).not.toHaveBeenCalled();
  });

  it("saves a committed entry through the repository", async () => {
    mockSignedIn();
    mockField();
    saveEntryMock.mockResolvedValueOnce({
      ok: true,
      data: {
        assignmentId: "assignment-1",
        entryId: "entry-1",
        entryDate: "2026-07-05",
        status: "active",
      },
    });

    const result = await saveTrackerEntryAction({
      fieldId,
      answer: { type: "boolean", value: false },
    });

    expect(result.status).toBe("saved");
    expect(result.result?.status).toBe("active");
    expect(saveEntryMock).toHaveBeenCalledWith({
      fieldId,
      answer: { type: "boolean", value: false },
    });
  });

  it("saves a draft through the repository", async () => {
    mockSignedIn();
    mockField();
    saveDraftMock.mockResolvedValueOnce({
      ok: true,
      data: {
        assignmentId: "assignment-1",
        draftId: "draft-1",
        entryDate: "2026-07-05",
        status: "draft",
      },
    });

    const result = await saveTrackerDraftAction({
      fieldId,
      answer: { type: "boolean", value: true },
    });

    expect(result.status).toBe("saved");
    expect(result.result?.status).toBe("draft");
    expect(saveDraftMock).toHaveBeenCalledWith({
      fieldId,
      answer: { type: "boolean", value: true },
    });
    expect(saveEntryMock).not.toHaveBeenCalled();
  });

  it("keeps Server Action source free of trusted client or coach ids", () => {
    const source = readFileSync(resolve(__dirname, "./actions.ts"), "utf-8");

    expect(source).not.toMatch(/client_id|coach_id/);
  });
});
