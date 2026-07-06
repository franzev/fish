"use client";

import type {
  FieldAnswer,
  FieldConfig,
  FieldOption,
  MultiSelectAnswer,
} from "@fish/core";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnswerChip } from "./answer-chip";
import { TextAreaField } from "./text-area-field";

export interface FieldRendererProps {
  config: FieldConfig;
  value: FieldAnswer | null;
  validationMessage?: string | null;
  disabled?: boolean;
  submitLabel?: string;
  showSubmit?: boolean;
  onChange: (answer: FieldAnswer) => void;
  onSubmit?: (answer: FieldAnswer) => void;
}

export function FieldRenderer({
  config,
  value,
  validationMessage,
  disabled = false,
  submitLabel = "Save answer",
  showSubmit = true,
  onChange,
  onSubmit,
}: FieldRendererProps) {
  switch (config.type) {
    case "single_select":
      return (
        <OptionGroup label={config.label} hint={config.hint}>
          {config.options.map((option) => (
            <AnswerChip
              key={option.id}
              selected={isOptionSelected(config.type, value, option.id)}
              disabled={disabled}
              onClick={() =>
                onChange({ type: "single_select", optionId: option.id })
              }
            >
              {option.label}
            </AnswerChip>
          ))}
        </OptionGroup>
      );

    case "multi_select": {
      const answer = coerceMultiSelectAnswer(value);
      return (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.(answer);
          }}
        >
          <OptionGroup
            label={config.label}
            hint={config.hint ?? multiSelectHint(config)}
          >
            {config.options.map((option) => (
              <AnswerChip
                key={option.id}
                selected={answer.optionIds.includes(option.id)}
                disabled={disabled}
                onClick={() => onChange(toggleMultiSelect(answer, option.id))}
              >
                {option.label}
              </AnswerChip>
            ))}
          </OptionGroup>
          {validationMessage && (
            <p className="text-ui-sm text-notice">{validationMessage}</p>
          )}
          {showSubmit && (
            <Button type="submit" fullWidth disabled={disabled}>
              {submitLabel}
            </Button>
          )}
        </form>
      );
    }

    case "scale":
      return (
        <OptionGroup label={config.label} hint={config.hint}>
          {config.options.map((option) => (
            <AnswerChip
              key={option.id}
              selected={isOptionSelected(config.type, value, option.id)}
              disabled={disabled}
              onClick={() => onChange({ type: "scale", value: option.id })}
            >
              {option.label}
            </AnswerChip>
          ))}
        </OptionGroup>
      );

    case "short_text": {
      const answer: Extract<FieldAnswer, { type: "short_text" }> =
        value?.type === "short_text" ? value : { type: "short_text", value: "" };
      return (
        <TextFieldForm
          answer={answer}
          config={config}
          disabled={disabled}
          validationMessage={validationMessage}
          submitLabel={submitLabel}
          showSubmit={showSubmit}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );
    }

    case "long_text": {
      const answer: Extract<FieldAnswer, { type: "long_text" }> =
        value?.type === "long_text" ? value : { type: "long_text", value: "" };
      return (
        <TextFieldForm
          answer={answer}
          config={config}
          disabled={disabled}
          validationMessage={validationMessage}
          submitLabel={submitLabel}
          showSubmit={showSubmit}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );
    }

    case "boolean":
      return (
        <OptionGroup label={config.label} hint={config.hint}>
          {config.options.map((option, index) => {
            const booleanValue = index === 0;
            return (
              <AnswerChip
                key={option.id}
                selected={value?.type === "boolean" && value.value === booleanValue}
                disabled={disabled}
                onClick={() =>
                  onChange({ type: "boolean", value: booleanValue })
                }
              >
                {option.label}
              </AnswerChip>
            );
          })}
        </OptionGroup>
      );
  }
}

function OptionGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-ui font-medium text-foreground">{label}</legend>
      {hint && <p className="text-ui-sm text-muted">{hint}</p>}
      <div className="grid gap-2">{children}</div>
    </fieldset>
  );
}

function TextFieldForm({
  answer,
  config,
  disabled,
  validationMessage,
  submitLabel,
  showSubmit,
  onChange,
  onSubmit,
}: {
  answer: Extract<FieldAnswer, { type: "short_text" | "long_text" }>;
  config: Extract<FieldConfig, { type: "short_text" | "long_text" }>;
  disabled: boolean;
  validationMessage?: string | null;
  submitLabel: string;
  showSubmit: boolean;
  onChange: (answer: FieldAnswer) => void;
  onSubmit?: (answer: FieldAnswer) => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(answer);
      }}
    >
      {config.type === "short_text" ? (
        <Input
          label={config.label}
          hint={config.hint}
          notice={validationMessage ?? undefined}
          disabled={disabled}
          maxLength={config.maxLength}
          placeholder={config.placeholder}
          value={answer.value}
          enterKeyHint="done"
          onChange={(event) =>
            onChange({ type: "short_text", value: event.target.value })
          }
        />
      ) : (
        <TextAreaField
          label={config.label}
          hint={config.hint}
          notice={validationMessage ?? undefined}
          disabled={disabled}
          maxLength={config.maxLength}
          placeholder={config.placeholder}
          value={answer.value}
          onChange={(event) =>
            onChange({ type: "long_text", value: event.target.value })
          }
        />
      )}
      {showSubmit && (
        <Button type="submit" fullWidth disabled={disabled}>
          {submitLabel}
        </Button>
      )}
    </form>
  );
}

function isOptionSelected(
  type: "single_select" | "scale",
  value: FieldAnswer | null,
  optionId: string
): boolean {
  if (type === "single_select") {
    return value?.type === "single_select" && value.optionId === optionId;
  }

  return value?.type === "scale" && value.value === optionId;
}

function coerceMultiSelectAnswer(value: FieldAnswer | null): MultiSelectAnswer {
  return value?.type === "multi_select"
    ? value
    : { type: "multi_select", optionIds: [] };
}

function toggleMultiSelect(
  answer: MultiSelectAnswer,
  optionId: FieldOption["id"]
): MultiSelectAnswer {
  const hasOption = answer.optionIds.includes(optionId);
  return {
    type: "multi_select",
    optionIds: hasOption
      ? answer.optionIds.filter((id) => id !== optionId)
      : [...answer.optionIds, optionId],
  };
}

function multiSelectHint(config: Extract<FieldConfig, { type: "multi_select" }>) {
  if (config.minSelections == null && config.maxSelections == null) {
    return undefined;
  }

  if (config.minSelections != null && config.maxSelections != null) {
    return `Choose ${config.minSelections} to ${config.maxSelections}.`;
  }

  if (config.minSelections != null) {
    return `Choose at least ${config.minSelections}.`;
  }

  return `Choose up to ${config.maxSelections}.`;
}
