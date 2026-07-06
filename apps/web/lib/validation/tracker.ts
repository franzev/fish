import {
  fieldAnswerSchema,
  fieldConfigSchema,
  parseFieldConfig,
  validateFieldAnswer,
} from "./onboarding";
import { z } from "zod";

const trackerConfigError =
  "This tracker needs a quick fix before you can use it.";

export { fieldAnswerSchema, fieldConfigSchema, parseFieldConfig, validateFieldAnswer };

export const saveTrackerEntrySchema = z.strictObject({
  fieldId: z.string().uuid({ error: trackerConfigError }),
  answer: fieldAnswerSchema,
});

export const saveTrackerDraftSchema = saveTrackerEntrySchema;

export const assignTrackerRequestSchema = z.strictObject({
  clientId: z.string().uuid({ error: trackerConfigError }),
});
