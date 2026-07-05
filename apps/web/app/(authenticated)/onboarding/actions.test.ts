import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FieldConfig } from "@fish/core";

const getCurrentUserMock = vi.fn();
const getQuestionForAnswerValidationMock = vi.fn();
const saveAnswerMock = vi.fn();
const finalizeAttemptMock = vi.fn();

vi.mock("@/lib/services/supabase/server", () => ({
  createServerSupabaseServices: async () => ({
    auth: { getCurrentUser: getCurrentUserMock },
    database: {
      onboarding: {
        getQuestionForAnswerValidation: getQuestionForAnswerValidationMock,
        saveAnswer: saveAnswerMock,
        finalizeAttempt: finalizeAttemptMock,
      },
    },
  }),
}));

import {
  finalizeOnboardingAttemptAction,
  saveOnboardingAnswerAction,
} from "./actions";

const questionId = "11111111-1111-4111-8111-111111111111";
type SaveActionValues = { answer?: unknown };

const singleSelectConfig: FieldConfig = {
  type: "single_select",
  label: "Choose the closest fit",
  options: [
    { id: "meetings", label: "Speaking in meetings" },
    { id: "writing", label: "Writing clearly" },
  ],
};

const scaleConfig: FieldConfig = {
  type: "scale",
  label: "Current feeling",
  options: [
    { id: "needs_support", label: "Needs support" },
    { id: "mostly_okay", label: "Mostly okay" },
  ],
};

const shortTextConfig: FieldConfig = {
  type: "short_text",
  label: "Work context",
  maxLength: 8,
};

function mockSignedIn() {
  getCurrentUserMock.mockResolvedValueOnce({
    ok: true,
    data: { id: "client-1" },
  });
}

function mockQuestion(config: FieldConfig) {
  getQuestionForAnswerValidationMock.mockResolvedValueOnce({
    ok: true,
    data: {
      id: questionId,
      prompt: "Question prompt",
      answerType: config.type,
      config,
    },
  });
}

describe("saveOnboardingAnswerAction", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    getQuestionForAnswerValidationMock.mockReset();
    saveAnswerMock.mockReset();
    finalizeAttemptMock.mockReset();
  });

  it("re-checks the session and preserves values on no-session notice", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ ok: true, data: null });
    const input = {
      questionId,
      answer: { type: "single_select", optionId: "meetings" },
    } as const;

    const result = await saveOnboardingAnswerAction(input);

    expect(result.status).toBe("notice");
    expect(result.values).toEqual(input);
    expect(result.notice).toBe("That did not save yet. Keep this open and try again.");
    expect(getQuestionForAnswerValidationMock).not.toHaveBeenCalled();
    expect(saveAnswerMock).not.toHaveBeenCalled();
  });

  it("rejects malformed action shape before loading config or saving", async () => {
    mockSignedIn();
    const input = {
      questionId: "not-a-uuid",
      answer: { type: "boolean", value: false },
    } as const;

    const result = await saveOnboardingAnswerAction(input);

    expect(result.status).toBe("notice");
    expect(result.values).toEqual(input);
    expect(getQuestionForAnswerValidationMock).not.toHaveBeenCalled();
    expect(saveAnswerMock).not.toHaveBeenCalled();
  });

  it("rejects unknown client-controlled ids through strict payload parsing", async () => {
    mockSignedIn();
    const input = {
      questionId,
      answer: { type: "single_select", optionId: "meetings" },
      client_id: "client-elsewhere",
    };

    const result = await saveOnboardingAnswerAction(input);

    expect(result.status).toBe("notice");
    expect(saveAnswerMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid option id before repository save", async () => {
    mockSignedIn();
    mockQuestion(singleSelectConfig);

    const result = await saveOnboardingAnswerAction({
      questionId,
      answer: { type: "single_select", optionId: "unknown" },
    });

    expect(result.status).toBe("notice");
    expect((result.values as SaveActionValues).answer).toEqual({
      type: "single_select",
      optionId: "unknown",
    });
    expect(saveAnswerMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid scale value before repository save", async () => {
    mockSignedIn();
    mockQuestion(scaleConfig);

    const result = await saveOnboardingAnswerAction({
      questionId,
      answer: { type: "scale", value: "ten" },
    });

    expect(result.status).toBe("notice");
    expect(saveAnswerMock).not.toHaveBeenCalled();
  });

  it("rejects too-long text before repository save", async () => {
    mockSignedIn();
    mockQuestion(shortTextConfig);

    const result = await saveOnboardingAnswerAction({
      questionId,
      answer: { type: "short_text", value: "customer calls" },
    });

    expect(result.status).toBe("notice");
    expect((result.values as SaveActionValues).answer).toEqual({
      type: "short_text",
      value: "customer calls",
    });
    expect(saveAnswerMock).not.toHaveBeenCalled();
  });

  it("saves a valid answer and returns resumable attempt state", async () => {
    mockSignedIn();
    mockQuestion(singleSelectConfig);
    saveAnswerMock.mockResolvedValueOnce({
      ok: true,
      data: {
        attemptId: "attempt-1",
        status: "in_progress",
        currentQuestionId: "question-2",
      },
    });

    const result = await saveOnboardingAnswerAction({
      questionId,
      answer: { type: "single_select", optionId: "meetings" },
    });

    expect(result.status).toBe("saved");
    expect(result.result?.currentQuestionId).toBe("question-2");
    expect(saveAnswerMock).toHaveBeenCalledWith({
      questionId,
      answer: { type: "single_select", optionId: "meetings" },
    });
  });

  it("keeps Server Action source free of trusted client or coach ids", () => {
    const source = readFileSync(resolve(__dirname, "./actions.ts"), "utf-8");

    expect(source).not.toMatch(/client_id|coach_id/);
  });
});

describe("finalizeOnboardingAttemptAction", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    finalizeAttemptMock.mockReset();
  });

  it("finalizes through the repository after session re-check", async () => {
    mockSignedIn();
    finalizeAttemptMock.mockResolvedValueOnce({
      ok: true,
      data: {
        attemptId: "attempt-1",
        status: "submitted",
        submittedAt: "2026-07-05T00:00:00Z",
      },
    });

    const result = await finalizeOnboardingAttemptAction();

    expect(result.status).toBe("complete");
    expect(result.result?.status).toBe("submitted");
    expect(finalizeAttemptMock).toHaveBeenCalledOnce();
    expect(JSON.stringify(result).toLowerCase()).not.toContain("recommendation");
  });
});
