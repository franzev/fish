"use server";

import type { FieldAnswer } from "@fish/core";
import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import type {
  OnboardingFinalizeResult,
  OnboardingSaveResult,
} from "@/lib/services";
import {
  parseFieldConfig,
  saveOnboardingAnswerSchema,
  validateFieldAnswer,
} from "@/lib/validation/onboarding";

const saveNotice = "That did not save yet. Keep this open and try again.";

export interface SaveOnboardingAnswerActionState {
  status: "saved" | "notice";
  values: unknown;
  notice?: string;
  result?: OnboardingSaveResult;
}

export interface FinalizeOnboardingAttemptActionState {
  status: "complete" | "notice";
  notice?: string;
  result?: OnboardingFinalizeResult;
}

export async function saveOnboardingAnswerAction(
  input: unknown
): Promise<SaveOnboardingAnswerActionState> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return { status: "notice", values: input, notice: saveNotice };
  }

  const parsed = saveOnboardingAnswerSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: saveNotice };
  }

  const questionResult =
    await services.database.onboarding.getQuestionForAnswerValidation(
      parsed.data.questionId
    );
  if (!questionResult.ok || !questionResult.data) {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  let config;
  try {
    config = parseFieldConfig(questionResult.data.config);
  } catch {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  const validation = validateFieldAnswer(config, parsed.data.answer);
  if (!validation.success) {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  const answer: FieldAnswer = validation.data;
  const saveResult = await services.database.onboarding.saveAnswer({
    questionId: parsed.data.questionId,
    answer,
  });

  if (!saveResult.ok) {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  return {
    status: "saved",
    values: parsed.data,
    result: saveResult.data,
  };
}

export async function finalizeOnboardingAttemptAction(): Promise<FinalizeOnboardingAttemptActionState> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return { status: "notice", notice: saveNotice };
  }

  const finalizeResult = await services.database.onboarding.finalizeAttempt();
  if (!finalizeResult.ok) {
    return { status: "notice", notice: saveNotice };
  }

  return {
    status: "complete",
    result: finalizeResult.data,
  };
}
