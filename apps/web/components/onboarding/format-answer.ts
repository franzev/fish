import type { FieldAnswer, FieldConfig } from "@fish/core";

export function formatAnswer(config: FieldConfig, answer: FieldAnswer): string {
  switch (answer.type) {
    case "single_select":
      return findOptionLabel(config, answer.optionId);
    case "multi_select":
      return answer.optionIds.length > 0
        ? answer.optionIds.map((id) => findOptionLabel(config, id)).join(", ")
        : "No answer selected";
    case "scale":
      return findOptionLabel(config, answer.value);
    case "short_text":
    case "long_text":
      return answer.value;
    case "boolean":
      return formatBooleanAnswer(config, answer.value);
  }
}

export function formatBooleanAnswer(config: FieldConfig, value: boolean): string {
  if (config.type !== "boolean") {
    return value ? "Yes" : "Not right now";
  }

  return value ? config.options[0].label : config.options[1].label;
}

export function findOptionLabel(config: FieldConfig, optionId: string): string {
  if (!("options" in config)) return optionId;

  return (
    config.options.find((option) => option.id === optionId)?.label ?? optionId
  );
}
