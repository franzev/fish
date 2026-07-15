import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageActions, type MessageActionResult } from "./message-actions";

function props() {
  return {
    mine: true,
    layout: "direct" as const,
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
    expect(toolbar).toHaveClass("right-full");
    expect(toolbar).toHaveClass("mr-xs");
    expect(toolbar).toHaveClass("z-10");
    expect(toolbar).not.toHaveClass("left-full");
    expect(toolbar).toHaveClass("inset-y-0");
    expect(toolbar).toHaveClass("my-auto");
    expect(toolbar).toHaveClass("h-fit");
    expect(toolbar).not.toHaveClass("-top-sm");
    expect(toolbar).not.toHaveClass("right-0");
    expect(toolbar).not.toHaveClass("right-md");
    expect(toolbar).not.toHaveClass("border-border");
    expect(reaction).toHaveClass("pointer-coarse:hidden");
    expect(edit).toHaveClass("pointer-coarse:hidden");
    expect(more).not.toHaveClass("pointer-coarse:hidden");
    expect(screen.queryByRole("button", { name: "Delete message" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply to message" })).toBeNull();
  });

  it("keeps received-message tools after the message", () => {
    render(<MessageActions {...props()} mine={false} />);

    const reaction = screen.getByRole("button", { name: "Add a reaction" });
    const reply = screen.getByRole("button", { name: "Reply to message" });
    const toolbar = reaction.parentElement;
    expect(toolbar).toHaveClass("left-full");
    expect(toolbar).toHaveClass("ml-xs");
    expect(toolbar).not.toHaveClass("right-full");
    expect(reply).toHaveClass("cursor-pointer", "size-control", "min-h-control");
    expect(reaction).toHaveClass(
      "cursor-pointer",
      "size-control",
      "min-h-control"
    );
  });

  it("keeps community tools at the row's top-right", () => {
    render(<MessageActions {...props()} layout="community" />);

    const reaction = screen.getByRole("button", { name: "Add a reaction" });
    expect(reaction.querySelector("svg")).toHaveClass("tabler-icon-mood-plus");
    const toolbar = reaction.parentElement;
    expect(toolbar).toHaveClass("-top-sm");
    expect(toolbar).toHaveClass("right-md");
    expect(toolbar).toHaveClass("h-fit");
    expect(toolbar).not.toHaveClass("inset-y-0");
    expect(toolbar).not.toHaveClass("my-auto");
    expect(toolbar).not.toHaveClass("-translate-y-1/2");
    expect(toolbar).not.toHaveClass("right-full");
  });

  it("keeps the direct-message reaction icon unchanged", () => {
    render(<MessageActions {...props()} />);

    expect(
      screen.getByRole("button", { name: "Add a reaction" }).querySelector("svg")
    ).toHaveClass("tabler-icon-mood-smile");
  });

  it.each([
    ["Reply to message", false],
    ["Edit message", true],
    ["More actions for message", true],
  ] as const)("shows a tooltip for %s", async (name, mine) => {
    render(<MessageActions {...props()} mine={mine} />);

    fireEvent.focus(screen.getByRole("button", { name }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(name);
  });

  it("shows a tooltip for the reaction picker's back control", async () => {
    render(<MessageActions {...props()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "More actions for message" })
    );
    const reactionActions = screen.getAllByRole("button", {
      name: "Add a reaction",
    });
    fireEvent.click(reactionActions[reactionActions.length - 1]!);

    const back = screen.getByRole("button", {
      name: "Back to message actions",
    });
    fireEvent.focus(back);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Back to message actions"
    );
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
