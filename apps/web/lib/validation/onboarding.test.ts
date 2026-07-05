import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fieldConfigSchema,
  parseFieldConfig,
  saveOnboardingAnswerSchema,
  validateFieldAnswer,
} from "./onboarding";

const validConfigs = {
  singleSelect: {
    type: "single_select",
    label: "Choose one",
    options: [
      { id: "meetings", label: "Speaking in meetings" },
      { id: "writing", label: "Writing clearly" },
    ],
  },
  multiSelect: {
    type: "multi_select",
    label: "Choose what helps",
    minSelections: 1,
    maxSelections: 2,
    options: [
      { id: "examples", label: "Clear examples" },
      { id: "practice", label: "Guided practice" },
      { id: "pace", label: "A slower pace" },
    ],
  },
  scale: {
    type: "scale",
    label: "Current feeling",
    options: [
      { id: "needs_support", label: "Needs support" },
      { id: "depends", label: "Depends on the day" },
      { id: "mostly_okay", label: "Mostly okay" },
    ],
  },
  shortText: {
    type: "short_text",
    label: "Work context",
    maxLength: 12,
    placeholder: "Meetings",
  },
  longText: {
    type: "long_text",
    label: "Anything helpful",
    maxLength: 20,
    placeholder: "Share anything useful",
  },
  boolean: {
    type: "boolean",
    label: "Practice time",
    options: [
      { id: "yes", label: "Yes" },
      { id: "not_right_now", label: "Not right now" },
    ],
  },
} as const;

describe("fieldConfigSchema", () => {
  it("accepts valid config for all six answer types", () => {
    for (const config of Object.values(validConfigs)) {
      expect(fieldConfigSchema.safeParse(config).success).toBe(true);
    }
  });

  it("rejects malformed config and score-like extra fields", () => {
    expect(
      fieldConfigSchema.safeParse({
        type: "single_select",
        label: "Choose one",
        score: 10,
        options: [{ id: "a", label: "A" }],
      }).success
    ).toBe(false);

    expect(
      fieldConfigSchema.safeParse({
        type: "single_select",
        label: "",
        options: [{ id: "a", label: "A" }],
      }).success
    ).toBe(false);

    expect(
      fieldConfigSchema.safeParse({
        type: "multi_select",
        label: "Choose what helps",
        minSelections: 3,
        maxSelections: 2,
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
      }).success
    ).toBe(false);
  });

  it("rejects duplicate option ids", () => {
    expect(
      fieldConfigSchema.safeParse({
        type: "scale",
        label: "Current feeling",
        options: [
          { id: "same", label: "First" },
          { id: "same", label: "Second" },
        ],
      }).success
    ).toBe(false);
  });

  it("parses valid config and throws on invalid config", () => {
    expect(parseFieldConfig(validConfigs.boolean).type).toBe("boolean");
    expect(() =>
      parseFieldConfig({
        type: "long_text",
        label: "Anything helpful",
        maxLength: 0,
      })
    ).toThrow("This question needs a quick fix before you can answer it.");
  });
});

describe("validateFieldAnswer", () => {
  it("accepts single-select answers with known option ids", () => {
    expect(
      validateFieldAnswer(validConfigs.singleSelect, {
        type: "single_select",
        optionId: "meetings",
      }).success
    ).toBe(true);

    expect(
      validateFieldAnswer(validConfigs.singleSelect, {
        type: "single_select",
        optionId: "unknown",
      }).success
    ).toBe(false);
  });

  it("accepts multi-select answers inside min/max bounds", () => {
    expect(
      validateFieldAnswer(validConfigs.multiSelect, {
        type: "multi_select",
        optionIds: ["examples", "practice"],
      }).success
    ).toBe(true);

    expect(
      validateFieldAnswer(validConfigs.multiSelect, {
        type: "multi_select",
        optionIds: [],
      }).success
    ).toBe(false);

    expect(
      validateFieldAnswer(validConfigs.multiSelect, {
        type: "multi_select",
        optionIds: ["examples", "practice", "pace"],
      }).success
    ).toBe(false);
  });

  it("accepts scale answers with known option ids", () => {
    expect(
      validateFieldAnswer(validConfigs.scale, {
        type: "scale",
        value: "depends",
      }).success
    ).toBe(true);

    expect(
      validateFieldAnswer(validConfigs.scale, {
        type: "scale",
        value: "ten",
      }).success
    ).toBe(false);
  });

  it("accepts short and long text within configured limits", () => {
    expect(
      validateFieldAnswer(validConfigs.shortText, {
        type: "short_text",
        value: "Meetings",
      }).success
    ).toBe(true);

    expect(
      validateFieldAnswer(validConfigs.shortText, {
        type: "short_text",
        value: "This is too long",
      }).success
    ).toBe(false);

    expect(
      validateFieldAnswer(validConfigs.longText, {
        type: "long_text",
        value: "Helpful context",
      }).success
    ).toBe(true);
  });

  it("accepts boolean payloads only for boolean config", () => {
    expect(
      validateFieldAnswer(validConfigs.boolean, {
        type: "boolean",
        value: true,
      }).success
    ).toBe(true);

    expect(
      validateFieldAnswer(validConfigs.boolean, {
        type: "boolean",
        value: "yes",
      }).success
    ).toBe(false);
  });

  it("rejects answer type mismatches", () => {
    expect(
      validateFieldAnswer(validConfigs.boolean, {
        type: "single_select",
        optionId: "yes",
      }).success
    ).toBe(false);
  });
});

describe("saveOnboardingAnswerSchema", () => {
  it("accepts a question id and normalized answer", () => {
    const result = saveOnboardingAnswerSchema.safeParse({
      questionId: "11111111-1111-4111-8111-111111111111",
      answer: { type: "boolean", value: false },
    });

    expect(result.success).toBe(true);
  });
});

describe("packages/core field contracts", () => {
  it("does not import zod from packages/core", () => {
    const coreFieldsPath = resolve(process.cwd(), "../../packages/core/src/fields.ts");
    const source = readFileSync(coreFieldsPath, "utf8");

    expect(source).not.toMatch(/from ["']zod["']/);
  });
});
