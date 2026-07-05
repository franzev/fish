import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { FieldAnswer, FieldConfig } from "@fish/core";
import { FieldRenderer } from "./field-renderer";

const configs = {
  singleSelect: {
    type: "single_select",
    label: "Choose the closest fit",
    options: [
      { id: "meetings", label: "Speaking in meetings" },
      { id: "writing", label: "Writing clearly" },
    ],
  },
  multiSelect: {
    type: "multi_select",
    label: "Support preferences",
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
    maxLength: 160,
    placeholder: "Team updates",
  },
  longText: {
    type: "long_text",
    label: "Anything helpful",
    maxLength: 1000,
    placeholder: "Share anything useful",
  },
  boolean: {
    type: "boolean",
    label: "Weekly practice time",
    options: [
      { id: "yes", label: "Yes" },
      { id: "not_right_now", label: "Not right now" },
    ],
  },
} satisfies Record<string, FieldConfig>;

function renderField(config: FieldConfig, value: FieldAnswer | null = null) {
  return render(
    <FieldRenderer
      config={config}
      value={value}
      onChange={vi.fn()}
      onSubmit={vi.fn()}
    />
  );
}

function countPrimaryButtons(container: HTMLElement): number {
  return Array.from(container.querySelectorAll("button")).filter((button) =>
    button.className.includes("bg-primary")
  ).length;
}

describe("FieldRenderer", () => {
  it("renders all six supported field types from config alone", () => {
    const expectations: Array<[FieldConfig, string]> = [
      [configs.singleSelect, "Speaking in meetings"],
      [configs.multiSelect, "Clear examples"],
      [configs.scale, "Depends on the day"],
      [configs.shortText, "Work context"],
      [configs.longText, "Anything helpful"],
      [configs.boolean, "Not right now"],
    ];

    for (const [config, visibleText] of expectations) {
      const { unmount } = renderField(config);
      expect(screen.getByText(visibleText)).toBeInTheDocument();
      unmount();
    }
  });

  it("uses accessible grouped button controls for option-like fields", () => {
    renderField(configs.singleSelect, {
      type: "single_select",
      optionId: "meetings",
    });

    const group = screen.getByRole("group", { name: "Choose the closest fit" });
    const selected = within(group).getByRole("button", {
      name: "Speaking in meetings",
    });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected.className).toContain("min-h-control");
    expect(selected.className).toContain("border-primary");
    expect(selected.className).toContain("bg-surface-2");
    expect(selected.className).toContain("font-semibold");
  });

  it("renders one explicit primary action for multi-select and text fields only", () => {
    const multi = renderField(configs.multiSelect, {
      type: "multi_select",
      optionIds: ["examples"],
    });
    expect(countPrimaryButtons(multi.container)).toBe(1);
    expect(screen.getByRole("button", { name: "Save answer" })).toBeInTheDocument();
    multi.unmount();

    const single = renderField(configs.singleSelect);
    expect(countPrimaryButtons(single.container)).toBe(0);
    single.unmount();

    const booleanField = renderField(configs.boolean);
    expect(countPrimaryButtons(booleanField.container)).toBe(0);
    booleanField.unmount();
  });

  it("wires short text and long text through visible labels and stable submit actions", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <FieldRenderer
        config={configs.shortText}
        value={{ type: "short_text", value: "Meetings" }}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText("Work context"), {
      target: { value: "Customer calls" },
    });
    expect(onChange).toHaveBeenCalledWith({
      type: "short_text",
      value: "Customer calls",
    });

    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    expect(onSubmit).toHaveBeenCalledWith({
      type: "short_text",
      value: "Meetings",
    });

    rerender(
      <FieldRenderer
        config={configs.longText}
        value={{ type: "long_text", value: "Context" }}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByLabelText("Anything helpful");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.nextElementSibling?.className).toContain(
      "min-h-field-message"
    );
  });

  it("does not branch on seeded onboarding question keys", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/fields/field-renderer.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(
      /language_goal|work_context|confidence_check|weekly_availability/
    );
  });
});
