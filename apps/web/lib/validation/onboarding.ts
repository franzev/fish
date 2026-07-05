import type { FieldAnswer, FieldConfig, FieldOption } from "@fish/core";
import { z } from "zod";

const questionConfigError =
  "This question needs a quick fix before you can answer it.";

const nonEmptyString = z.string().trim().min(1, { error: questionConfigError });

const fieldOptionSchema = z.strictObject({
  id: nonEmptyString,
  label: nonEmptyString,
});

function addDuplicateOptionIssue(
  options: FieldOption[],
  ctx: z.RefinementCtx
): void {
  const ids = new Set<string>();
  for (const option of options) {
    if (ids.has(option.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: questionConfigError,
      });
      return;
    }
    ids.add(option.id);
  }
}

const singleSelectConfigSchema = z
  .strictObject({
    type: z.literal("single_select"),
    label: nonEmptyString,
    hint: z.string().trim().optional(),
    options: z.array(fieldOptionSchema).min(1, { error: questionConfigError }),
  })
  .superRefine((config, ctx) => addDuplicateOptionIssue(config.options, ctx));

const multiSelectConfigSchema = z
  .strictObject({
    type: z.literal("multi_select"),
    label: nonEmptyString,
    hint: z.string().trim().optional(),
    minSelections: z.number().int().min(0).optional(),
    maxSelections: z.number().int().min(1).optional(),
    options: z.array(fieldOptionSchema).min(1, { error: questionConfigError }),
  })
  .superRefine((config, ctx) => {
    addDuplicateOptionIssue(config.options, ctx);

    const minSelections = config.minSelections ?? 0;
    const maxSelections = config.maxSelections ?? config.options.length;
    if (
      minSelections > maxSelections ||
      maxSelections > config.options.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxSelections"],
        message: questionConfigError,
      });
    }
  });

const scaleConfigSchema = z
  .strictObject({
    type: z.literal("scale"),
    label: nonEmptyString,
    hint: z.string().trim().optional(),
    options: z.array(fieldOptionSchema).min(2, { error: questionConfigError }),
  })
  .superRefine((config, ctx) => addDuplicateOptionIssue(config.options, ctx));

const shortTextConfigSchema = z.strictObject({
  type: z.literal("short_text"),
  label: nonEmptyString,
  hint: z.string().trim().optional(),
  maxLength: z.number().int().min(1).optional(),
  placeholder: z.string().trim().optional(),
});

const longTextConfigSchema = z.strictObject({
  type: z.literal("long_text"),
  label: nonEmptyString,
  hint: z.string().trim().optional(),
  maxLength: z.number().int().min(1).optional(),
  placeholder: z.string().trim().optional(),
});

const booleanConfigSchema = z
  .strictObject({
    type: z.literal("boolean"),
    label: nonEmptyString,
    hint: z.string().trim().optional(),
    options: z
      .array(fieldOptionSchema)
      .length(2, { error: questionConfigError }),
  })
  .superRefine((config, ctx) => addDuplicateOptionIssue(config.options, ctx));

export const fieldConfigSchema = z.discriminatedUnion("type", [
  singleSelectConfigSchema,
  multiSelectConfigSchema,
  scaleConfigSchema,
  shortTextConfigSchema,
  longTextConfigSchema,
  booleanConfigSchema,
]);

const singleSelectAnswerSchema = z.strictObject({
  type: z.literal("single_select"),
  optionId: nonEmptyString,
});

const multiSelectAnswerSchema = z.strictObject({
  type: z.literal("multi_select"),
  optionIds: z.array(nonEmptyString),
});

const scaleAnswerSchema = z.strictObject({
  type: z.literal("scale"),
  value: nonEmptyString,
});

const shortTextAnswerSchema = z.strictObject({
  type: z.literal("short_text"),
  value: z.string().trim(),
});

const longTextAnswerSchema = z.strictObject({
  type: z.literal("long_text"),
  value: z.string().trim(),
});

const booleanAnswerSchema = z.strictObject({
  type: z.literal("boolean"),
  value: z.boolean(),
});

export const fieldAnswerSchema = z.discriminatedUnion("type", [
  singleSelectAnswerSchema,
  multiSelectAnswerSchema,
  scaleAnswerSchema,
  shortTextAnswerSchema,
  longTextAnswerSchema,
  booleanAnswerSchema,
]);

export const saveOnboardingAnswerSchema = z.strictObject({
  questionId: z.string().uuid({ error: questionConfigError }),
  answer: fieldAnswerSchema,
});

type FieldAnswerValidationResult =
  | { success: true; data: FieldAnswer }
  | { success: false; error: string };

export function parseFieldConfig(input: unknown): FieldConfig {
  const result = fieldConfigSchema.safeParse(input);
  if (!result.success) {
    throw new Error(questionConfigError);
  }

  return result.data as FieldConfig;
}

export function validateFieldAnswer(
  configInput: unknown,
  answerInput: unknown
): FieldAnswerValidationResult {
  const configResult = fieldConfigSchema.safeParse(configInput);
  if (!configResult.success) {
    return { success: false, error: questionConfigError };
  }

  const answerResult = fieldAnswerSchema.safeParse(answerInput);
  if (!answerResult.success) {
    return { success: false, error: "That answer does not fit this question yet." };
  }

  const config = configResult.data as FieldConfig;
  const answer = answerResult.data as FieldAnswer;

  if (config.type !== answer.type) {
    return { success: false, error: "That answer does not fit this question yet." };
  }

  switch (config.type) {
    case "single_select": {
      const typedAnswer = answer as Extract<FieldAnswer, { type: "single_select" }>;
      return optionIdSet(config.options).has(typedAnswer.optionId)
        ? { success: true, data: answer }
        : { success: false, error: "Choose one of the available answers." };
    }
    case "multi_select": {
      const typedAnswer = answer as Extract<FieldAnswer, { type: "multi_select" }>;
      const ids = optionIdSet(config.options);
      const selected = new Set(typedAnswer.optionIds);
      const minSelections = config.minSelections ?? 0;
      const maxSelections = config.maxSelections ?? config.options.length;
      const hasOnlyKnownIds = typedAnswer.optionIds.every((id) => ids.has(id));
      const hasUniqueIds = selected.size === typedAnswer.optionIds.length;
      const isInsideBounds =
        typedAnswer.optionIds.length >= minSelections &&
        typedAnswer.optionIds.length <= maxSelections;

      return hasOnlyKnownIds && hasUniqueIds && isInsideBounds
        ? { success: true, data: answer }
        : { success: false, error: "Choose the answers that fit this question." };
    }
    case "scale": {
      const typedAnswer = answer as Extract<FieldAnswer, { type: "scale" }>;
      return optionIdSet(config.options).has(typedAnswer.value)
        ? { success: true, data: answer }
        : { success: false, error: "Choose one of the available answers." };
    }
    case "short_text":
    case "long_text": {
      const typedAnswer = answer as Extract<
        FieldAnswer,
        { type: "short_text" | "long_text" }
      >;
      const maxLength = config.maxLength;
      if (maxLength && typedAnswer.value.length > maxLength) {
        return { success: false, error: "Shorten this a little before saving." };
      }

      return { success: true, data: answer };
    }
    case "boolean":
      return { success: true, data: answer };
    default:
      return { success: false, error: "That answer does not fit this question yet." };
  }
}

function optionIdSet(options: FieldOption[]): Set<string> {
  return new Set(options.map((option) => option.id));
}
