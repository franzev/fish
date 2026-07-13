import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconSearch } from "@tabler/icons-react";
import { Input, inputVariants } from "./input";

describe("Input", () => {
  it("exposes reusable CVA feedback variants for the maintained field styles", () => {
    // Default field is a borderless surface-step well (chat's field idiom);
    // the constant transparent border keeps the box stable across tiers.
    expect(inputVariants()).toContain("bg-surface-2");
    expect(inputVariants()).toContain("border-transparent");
    expect(inputVariants({ feedback: "notice" })).toContain(
      "border-border-strong"
    );
    expect(inputVariants({ feedback: "error" })).toContain("border-error");
  });

  it("uses the default 44px interaction-target token (KIT-04)", () => {
    const { getByLabelText } = render(<Input label="Email" />);
    expect(getByLabelText("Email").className).toContain(
      "min-h-control"
    );
  });

  it("does not add a focus-only border or shadow", () => {
    const classes = inputVariants();
    expect(classes).not.toMatch(/focus-visible:(?:border|outline|ring|shadow)/);
  });

  it("always renders the message row, even with no hint/notice/error (layout-stability contract)", () => {
    const { container } = render(<Input label="Email" />);
    // The reserved row is a sibling of the field, present whether or not a
    // message is shown — its mount/unmount never toggles.
    const field = container.querySelector("input");
    const reservedRow = field?.nextElementSibling;
    expect(reservedRow).not.toBeNull();
    expect(reservedRow?.textContent).toBe("");
  });

  it("the message row reserves a constant min-height regardless of message presence", () => {
    const { container } = render(<Input label="Email" />);
    const field = container.querySelector("input");
    const reservedRow = field?.nextElementSibling as HTMLElement;
    expect(reservedRow.className).toContain("min-h-field-message");
  });

  it("can skip the empty reserved row when a compact form owns spacing", () => {
    const { container } = render(
      <Input label="Email" reserveMessageSpace={false} />
    );
    const field = container.querySelector("input");
    expect(field?.nextElementSibling).toBeNull();
  });

  it("supports compact search fields with a hidden label and leading icon", () => {
    const { getByRole, container } = render(
      <Input
        type="search"
        label="Search"
        labelVisuallyHidden
        reserveMessageSpace={false}
        density="compact"
        leadingIcon={<IconSearch aria-hidden="true" />}
      />
    );

    const field = getByRole("searchbox", { name: "Search" });
    expect(field.className).toContain("sm:min-h-search-control");
    expect(field.className).toContain("sm:pl-search-control");
    expect(container.querySelector("label")).toHaveClass("sr-only");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("notice tier: field carries border-border-strong, message is regular weight with an info icon", () => {
    const { getByLabelText, getByText, container } = render(
      <Input
        label="Email"
        notice="That doesn't look like an email yet. Check the spelling?"
      />
    );
    expect(getByLabelText("Email").className).toContain("border-border-strong");
    const message = getByText(
      "That doesn't look like an email yet. Check the spelling?"
    );
    expect(message.className).not.toContain("font-semibold");
    expect(getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      message.id
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("error tier: field carries the border-error hairline, message is semibold with an alert icon", () => {
    const { getByLabelText, getByText, container } = render(
      <Input
        label="Email"
        error="Something needs your attention before you can continue."
      />
    );
    const field = getByLabelText("Email");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.className).toContain("border-error");
    const message = getByText(
      "Something needs your attention before you can continue."
    );
    expect(message.className).toContain("font-semibold");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("error wins when both notice and error are passed (mutually exclusive)", () => {
    const { getByLabelText, queryByText, getByText } = render(
      <Input
        label="Email"
        notice="Notice message"
        error="Error message"
      />
    );
    const field = getByLabelText("Email");
    expect(field.className).toContain("border-error");
    expect(field.className).not.toContain("border-border-strong");
    expect(queryByText("Notice message")).toBeNull();
    expect(getByText("Error message")).not.toBeNull();
  });

  it("disabled propagates to the input element", () => {
    const { getByLabelText } = render(<Input label="Email" disabled />);
    expect(getByLabelText("Email")).toBeDisabled();
  });

  it("preserves a caller-provided aria-invalid state without an error message", () => {
    const { getByLabelText } = render(
      <Input label="Email" aria-invalid="grammar" />
    );

    expect(getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "grammar"
    );
  });
});
