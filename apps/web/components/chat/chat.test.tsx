import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar } from "./avatar";
import { MessageActions } from "./message-actions";
import { MessageStatus } from "./message-status";
import { Reactions } from "./reactions";
import { TypingIndicator } from "./typing-indicator";

describe("Avatar", () => {
  it("renders an image with alt text when given a valid src", () => {
    render(<Avatar src="https://example.com/pic.png" name="Alex Rivera" />);
    const img = screen.getByRole("img", { name: "Alex Rivera's avatar" });
    expect(img).toHaveAttribute("src", "https://example.com/pic.png");
  });

  it("falls back to initials (max 2, uppercase) when no src is given", () => {
    render(<Avatar name="Alex Rivera" />);
    expect(screen.getByText("AR")).toBeInTheDocument();
  });

  it("falls back to a neutral placeholder when neither src nor name is given, and never throws", () => {
    expect(() => render(<Avatar />)).not.toThrow();
    expect(screen.getByText("User avatar")).toBeInTheDocument();
  });

  it("falls back to initials when the image fails to load", () => {
    render(<Avatar src="https://example.com/broken.png" name="Sam Lee" />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(screen.getByText("SL")).toBeInTheDocument();
  });
});

describe("MessageStatus", () => {
  it.each([
    ["sending", "Sending"],
    ["sent", "Sent"],
    ["delivered", "Delivered"],
    ["read", "Read"],
  ] as const)("renders an accessible label for status %s", (status, label) => {
    render(<MessageStatus status={status} />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });
});

describe("TypingIndicator", () => {
  it("has an accessible 'typing' label", () => {
    render(<TypingIndicator />);
    expect(screen.getByRole("status", { name: "typing" })).toBeInTheDocument();
  });

  it("renders three animated dots", () => {
    const { container } = render(<TypingIndicator />);
    expect(container.querySelectorAll(".animate-typing")).toHaveLength(3);
  });
});

describe("Reactions", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(<Reactions reactions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when reactions is undefined", () => {
    const { container } = render(<Reactions />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current user's reaction pill and carries an aria-label per pill", () => {
    render(
      <Reactions
        reactions={[
          { emoji: "👍", count: 2, byMe: true },
          { emoji: "🎉", count: 1, byMe: false },
        ]}
      />
    );
    const mine = screen.getByRole("button", { name: /including you/ });
    expect(mine).toHaveAttribute("aria-pressed", "true");
    expect(mine.className).toContain("bg-surface-2");

    const theirs = screen.getByRole("button", { name: /🎉 reaction, 1 person/ });
    expect(theirs).toHaveAttribute("aria-pressed", "false");
  });
});

describe("MessageActions", () => {
  it("exposes aria-labels for all five actions", () => {
    render(<MessageActions />);
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forward" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("delete uses the calm notice tone, never a red chrome class", () => {
    render(<MessageActions />);
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton.className).toContain("text-notice");
    expect(deleteButton.className).not.toMatch(/text-error|bg-error|border-error/);
  });

  it("invokes the matching callback per action", () => {
    const onDelete = vi.fn();
    const onCopy = vi.fn();
    render(<MessageActions onDelete={onDelete} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
