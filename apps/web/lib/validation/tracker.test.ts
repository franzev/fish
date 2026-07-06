import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assignTrackerRequestSchema,
  fieldConfigSchema,
  saveTrackerDraftSchema,
  saveTrackerEntrySchema,
  validateFieldAnswer,
} from "./tracker";

const fieldId = "11111111-1111-4111-8111-111111111111";
const clientId = "22222222-2222-4222-8222-222222222222";

const validConfigs = {
  singleSelect: {
    type: "single_select",
    label: "Practice focus",
    options: [
      { id: "meeting", label: "Meeting phrases" },
      { id: "email", label: "Email clarity" },
    ],
  },
  multiSelect: {
    type: "multi_select",
    label: "What helped today?",
    minSelections: 1,
    maxSelections: 2,
    options: [
      { id: "examples", label: "Clear examples" },
      { id: "practice", label: "Guided practice" },
      { id: "time", label: "Enough time" },
    ],
  },
  scale: {
    type: "scale",
    label: "How did practice feel?",
    options: [
      { id: "hard", label: "Hard today" },
      { id: "steady", label: "Steady" },
      { id: "lighter", label: "Lighter" },
    ],
  },
  shortText: {
    type: "short_text",
    label: "One phrase",
    maxLength: 24,
  },
  longText: {
    type: "long_text",
    label: "Reflection",
    maxLength: 120,
  },
  boolean: {
    type: "boolean",
    label: "Did you have a moment for English today?",
    options: [
      { id: "yes", label: "Yes" },
      { id: "not_today", label: "Not today" },
    ],
  },
} as const;

const validAnswers = {
  singleSelect: { type: "single_select", optionId: "meeting" },
  multiSelect: { type: "multi_select", optionIds: ["examples"] },
  scale: { type: "scale", value: "steady" },
  shortText: { type: "short_text", value: "Could we review this?" },
  longText: { type: "long_text", value: "I practiced a softer way to ask." },
  boolean: { type: "boolean", value: true },
} as const;

describe("saveTrackerEntrySchema", () => {
  it("accepts a field id and normalized answer", () => {
    expect(
      saveTrackerEntrySchema.safeParse({
        fieldId,
        answer: validAnswers.boolean,
      }).success
    ).toBe(true);
  });

  it("rejects a non-uuid field id or malformed answer", () => {
    expect(
      saveTrackerEntrySchema.safeParse({
        fieldId: "not-a-uuid",
        answer: validAnswers.boolean,
      }).success
    ).toBe(false);

    expect(
      saveTrackerEntrySchema.safeParse({
        fieldId,
        answer: { type: "boolean", value: "yes" },
      }).success
    ).toBe(false);
  });
});

describe("saveTrackerDraftSchema", () => {
  it("uses the same strict payload as committed tracker entries", () => {
    expect(
      saveTrackerDraftSchema.safeParse({
        fieldId,
        answer: validAnswers.boolean,
      }).success
    ).toBe(true);
    expect(
      saveTrackerDraftSchema.safeParse({
        fieldId,
        answer: validAnswers.boolean,
        clientId,
      }).success
    ).toBe(false);
  });
});

describe("assignTrackerRequestSchema", () => {
  it("accepts only a client id", () => {
    expect(assignTrackerRequestSchema.safeParse({ clientId }).success).toBe(true);
  });

  it("rejects missing, invalid, or caller-supplied trusted fields", () => {
    expect(assignTrackerRequestSchema.safeParse({}).success).toBe(false);
    expect(assignTrackerRequestSchema.safeParse({ clientId: "nope" }).success).toBe(false);
    expect(
      assignTrackerRequestSchema.safeParse({
        clientId,
        coachId: "33333333-3333-4333-8333-333333333333",
      }).success
    ).toBe(false);
    expect(
      assignTrackerRequestSchema.safeParse({
        clientId,
        versionId: "44444444-4444-4444-8444-444444444444",
      }).success
    ).toBe(false);
  });
});

describe("tracker field config and answer validation", () => {
  it("accepts valid config for all six answer types", () => {
    for (const config of Object.values(validConfigs)) {
      expect(fieldConfigSchema.safeParse(config).success).toBe(true);
    }
  });

  it("rejects malformed field config for each answer type", () => {
    const malformed = [
      { ...validConfigs.singleSelect, options: [] },
      { ...validConfigs.multiSelect, minSelections: 3, maxSelections: 2 },
      { ...validConfigs.scale, options: [{ id: "same", label: "Same" }] },
      { ...validConfigs.shortText, maxLength: 0 },
      { ...validConfigs.longText, label: "" },
      { ...validConfigs.boolean, options: [{ id: "yes", label: "Yes" }] },
    ];

    for (const config of malformed) {
      expect(fieldConfigSchema.safeParse(config).success).toBe(false);
    }
  });

  it("accepts valid answers for each config type", () => {
    expect(validateFieldAnswer(validConfigs.singleSelect, validAnswers.singleSelect).success).toBe(true);
    expect(validateFieldAnswer(validConfigs.multiSelect, validAnswers.multiSelect).success).toBe(true);
    expect(validateFieldAnswer(validConfigs.scale, validAnswers.scale).success).toBe(true);
    expect(validateFieldAnswer(validConfigs.shortText, validAnswers.shortText).success).toBe(true);
    expect(validateFieldAnswer(validConfigs.longText, validAnswers.longText).success).toBe(true);
    expect(validateFieldAnswer(validConfigs.boolean, validAnswers.boolean).success).toBe(true);
  });

  it("rejects mismatched answers", () => {
    expect(
      validateFieldAnswer(validConfigs.boolean, validAnswers.singleSelect).success
    ).toBe(false);
    expect(
      validateFieldAnswer(validConfigs.singleSelect, {
        type: "single_select",
        optionId: "unknown",
      }).success
    ).toBe(false);
  });
});

describe("packages/core boundary", () => {
  it("does not import zod from packages/core", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../../packages/core/src/fields.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from ["']zod["']/);
  });
});
