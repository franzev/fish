import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageActions, type MessageActionResult } from "./message-actions";

function props() {
  return {
    mine: true,
    canEdit: true,
    canDelete: true,
    canReportGif: false,
    onReply: vi.fn(),
    onReact: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(async (): Promise<MessageActionResult> => ({ ok: true })),
    onReportGif: vi.fn(),
  };
}

describe("MessageActions", () => {
  it("keeps the own-message toolbar compact", () => {
    render(<MessageActions {...props()} />);

    const reaction = screen.getByRole("button", { name: "Add a reaction" });
    const toolbar = reaction.parentElement;
    const edit = screen.getByRole("button", { name: "Edit message" });
    const more = screen.getByRole("button", { name: "More actions for message" });
    expect(toolbar).toHaveClass("border-divider");
    expect(toolbar).not.toHaveClass("border-border");
    expect(reaction).toHaveClass("pointer-coarse:hidden");
    expect(edit).toHaveClass("pointer-coarse:hidden");
    expect(more).not.toHaveClass("pointer-coarse:hidden");
    expect(screen.queryByRole("button", { name: "Delete message" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply to message" })).toBeNull();
  });

  it("keeps destructive deletion behind truthful confirmation", async () => {
    const viewProps = props();
    render(<MessageActions {...viewProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions for message" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));

    expect(viewProps.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this message?")).toBeInTheDocument();
    expect(
      screen.getByText(/remain in the conversation as Message deleted/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));
    await waitFor(() => expect(viewProps.onDelete).toHaveBeenCalledOnce());
  });

  it("keeps confirmation open with calm guidance when deletion fails", async () => {
    const viewProps = props();
    viewProps.onDelete.mockResolvedValueOnce({
      ok: false,
      notice: "That didn’t delete yet. Keep this open and try again.",
    });
    render(<MessageActions {...viewProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions for message" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));

    expect(
      await screen.findByText("That didn’t delete yet. Keep this open and try again.")
    ).toBeInTheDocument();
    expect(screen.getByText("Delete this message?")).toBeInTheDocument();
  });

  it("cancels deletion without running the destructive action", () => {
    const viewProps = props();
    render(<MessageActions {...viewProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions for message" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(viewProps.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete this message?")).toBeNull();
  });

  it("makes the full reaction picker reachable from the more-actions surface", () => {
    render(<MessageActions {...props()} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions for message" }));
    const reactionActions = screen.getAllByRole("button", { name: "Add a reaction" });
    fireEvent.click(reactionActions[reactionActions.length - 1]!);

    expect(screen.getByRole("region", { name: "Browse emoji" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to message actions" })
    ).toBeInTheDocument();
  });
});
