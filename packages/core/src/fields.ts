export type FieldType =
  | "single_select"
  | "multi_select"
  | "scale"
  | "short_text"
  | "long_text"
  | "boolean";

export interface FieldOption {
  id: string;
  label: string;
}

interface BaseFieldConfig {
  type: FieldType;
  label: string;
  hint?: string;
}

interface OptionFieldConfig extends BaseFieldConfig {
  options: FieldOption[];
}

export interface SingleSelectFieldConfig extends OptionFieldConfig {
  type: "single_select";
}

export interface MultiSelectFieldConfig extends OptionFieldConfig {
  type: "multi_select";
  minSelections?: number;
  maxSelections?: number;
}

export interface ScaleFieldConfig extends OptionFieldConfig {
  type: "scale";
}

export interface ShortTextFieldConfig extends BaseFieldConfig {
  type: "short_text";
  maxLength?: number;
  placeholder?: string;
}

export interface LongTextFieldConfig extends BaseFieldConfig {
  type: "long_text";
  maxLength?: number;
  placeholder?: string;
}

export interface BooleanFieldConfig extends BaseFieldConfig {
  type: "boolean";
  options: [FieldOption, FieldOption];
}

export type FieldConfig =
  | SingleSelectFieldConfig
  | MultiSelectFieldConfig
  | ScaleFieldConfig
  | ShortTextFieldConfig
  | LongTextFieldConfig
  | BooleanFieldConfig;

export interface SingleSelectAnswer {
  type: "single_select";
  optionId: string;
}

export interface MultiSelectAnswer {
  type: "multi_select";
  optionIds: string[];
}

export interface ScaleAnswer {
  type: "scale";
  value: string;
}

export interface ShortTextAnswer {
  type: "short_text";
  value: string;
}

export interface LongTextAnswer {
  type: "long_text";
  value: string;
}

export interface BooleanAnswer {
  type: "boolean";
  value: boolean;
}

export type FieldAnswer =
  | SingleSelectAnswer
  | MultiSelectAnswer
  | ScaleAnswer
  | ShortTextAnswer
  | LongTextAnswer
  | BooleanAnswer;

export interface OnboardingQuestion {
  id: string;
  questionKey: string;
  questionOrder: number;
  prompt: string;
  config: FieldConfig;
}

export type OnboardingAttemptStatus = "in_progress" | "submitted";

export interface OnboardingReviewAnswer {
  id: string;
  questionId: string;
  questionKey: string;
  questionOrder: number;
  questionPrompt: string;
  config: FieldConfig;
  answer: FieldAnswer;
  answeredAt: string;
}

export interface OnboardingReviewData {
  attemptId: string;
  status: OnboardingAttemptStatus;
  submittedAt: string | null;
  answers: OnboardingReviewAnswer[];
}
