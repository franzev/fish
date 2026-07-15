import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageEditor } from "./message-editor";

function props() {
  return {
    originalBody: "Original message",
    draft: "Revised message",
    notice: null,
    saving: false,
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe("MessageEditor", () => {
  it("focuses the inline field and exposes pointer and keyboard save paths", () => {
    const viewProps = props();
    render(<MessageEditor {...viewProps} />);

    const editor = screen.getByRole("textbox", { name: "Edit message" });
    expect(editor).toHaveFocus();
    expect(screen.getByText(/Enter to save/)).toHaveClass(
      "pointer-coarse:hidden"
    );
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const saveButton = screen.getByRole("button", { name: "Save changes" });

    expect(cancelButton).toHaveAccessibleName("Cancel");
    expect(saveButton).toHaveAccessibleName("Save changes");
    expect(cancelButton).toHaveClass("size-control", "min-h-control", "px-0");
    expect(saveButton).toHaveClass("size-control", "min-h-control", "px-0");

    fireEvent.keyDown(editor, { key: "Enter" });
    expect(viewProps.onSave).toHaveBeenCalledOnce();

    fireEvent.click(saveButton);
    expect(viewProps.onSave).toHaveBeenCalledTimes(2);
  });

  it("keeps new lines and supports Escape cancellation", () => {
    const viewProps = props();
    render(<MessageEditor {...viewProps} />);
    const editor = screen.getByRole("textbox", { name: "Edit message" });

    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    expect(viewProps.onSave).not.toHaveBeenCalled();

    fireEvent.keyDown(editor, { key: "Enter", isComposing: true });
    expect(viewProps.onSave).not.toHaveBeenCalled();

    fireEvent.keyDown(editor, { key: "Escape" });
    expect(viewProps.onCancel).toHaveBeenCalledOnce();
  });

  it("explains why unchanged or blank messages cannot be saved", () => {
    const viewProps = props();
    const { rerender } = render(
      <MessageEditor {...viewProps} draft="Original message" />
    );

    expect(screen.getByText("Make a change before saving.")).not.toHaveClass(
      "pointer-coarse:hidden"
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    rerender(<MessageEditor {...viewProps} draft="   " />);
    expect(screen.getByText("Add some text before saving.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("keeps a failed save notice next to the retained draft", () => {
    render(
      <MessageEditor
        {...props()}
        notice="That didn’t save yet. Your changes are still here. Try again."
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "That didn’t save yet. Your changes are still here. Try again."
    );
    expect(screen.getByRole("textbox", { name: "Edit message" })).toHaveValue(
      "Revised message"
    );
  });
});
