"use server";

import type { FieldAnswer } from "@fish/core";
import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import type { TrackerDraftResult, TrackerSaveResult } from "@/lib/services";
import {
  parseFieldConfig,
  saveTrackerDraftSchema,
  saveTrackerEntrySchema,
  validateFieldAnswer,
} from "@/lib/validation/tracker";

const saveNotice = "That did not save yet. Keep this open and try again.";

export interface SaveTrackerEntryActionState {
  status: "saved" | "notice";
  values: unknown;
  notice?: string;
  result?: TrackerSaveResult;
}

export interface SaveTrackerDraftActionState {
  status: "saved" | "notice";
  values: unknown;
  notice?: string;
  result?: TrackerDraftResult;
}

export async function saveTrackerEntryAction(
  input: unknown
): Promise<SaveTrackerEntryActionState> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return { status: "notice", values: input, notice: saveNotice };
  }

  const parsed = saveTrackerEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: saveNotice };
  }

  const fieldResult =
    await services.database.tracker.getFieldForAnswerValidation(
      parsed.data.fieldId
    );
  if (!fieldResult.ok || !fieldResult.data) {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  let config;
  try {
    config = parseFieldConfig(fieldResult.data.config);
  } catch {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  const validation = validateFieldAnswer(config, parsed.data.answer);
  if (!validation.success) {
    return { status: "notice", values: parsed.data, notice: validation.error };
  }

  const answer: FieldAnswer = validation.data;
  const saveResult = await services.database.tracker.saveEntry({
    fieldId: parsed.data.fieldId,
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

export async function saveTrackerDraftAction(
  input: unknown
): Promise<SaveTrackerDraftActionState> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return { status: "notice", values: input, notice: saveNotice };
  }

  const parsed = saveTrackerDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: saveNotice };
  }

  const fieldResult =
    await services.database.tracker.getFieldForAnswerValidation(
      parsed.data.fieldId
    );
  if (!fieldResult.ok || !fieldResult.data) {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  let config;
  try {
    config = parseFieldConfig(fieldResult.data.config);
  } catch {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  const validation = validateFieldAnswer(config, parsed.data.answer);
  if (!validation.success) {
    return { status: "notice", values: parsed.data, notice: validation.error };
  }

  const answer: FieldAnswer = validation.data;
  const saveResult = await services.database.tracker.saveDraft({
    fieldId: parsed.data.fieldId,
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
