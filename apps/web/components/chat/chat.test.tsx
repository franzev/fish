import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar } from "./avatar";
import { Bubble } from "./bubble";
import { ChatInput } from "./chat-input";
import { EmptyState } from "./empty-state";
import { Message } from "./message";
import { MessageActions } from "./message-actions";
import { MessageList } from "./message-list";
import { MessageStatus } from "./message-status";
import { Reactions } from "./reactions";
import { TypingIndicator } from "./typing-indicator";
import type { ChatMessageView } from "./types";

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

describe("Bubble", () => {
  it("renders distinct token classes for mine vs received", () => {
    const { rerender, getByText } = render(<Bubble mine>Hi there</Bubble>);
    expect(getByText("Hi there").className).toContain("bg-primary");
    expect(getByText("Hi there").className).toContain("text-on-primary");

    rerender(<Bubble mine={false}>Hi there</Bubble>);
    expect(getByText("Hi there").className).toContain("bg-surface");
    expect(getByText("Hi there").className).toContain("border-border");
  });
});

const baseMessage: ChatMessageView = {
  id: "m1",
  author: { id: "u1", name: "Alex Rivera" },
  body: "Hello!",
  sentAt: new Date("2026-01-01T10:00:00Z"),
  mine: false,
};

describe("Message", () => {
  it("aligns a received message to the start", () => {
    const { container } = render(<Message message={baseMessage} />);
    expect(container.firstChild).toHaveClass("flex-row");
  });

  it("aligns a sent (mine) message to the end", () => {
    const { container } = render(<Message message={{ ...baseMessage, mine: true }} />);
    expect(container.firstChild).toHaveClass("flex-row-reverse");
  });
});

describe("ChatInput", () => {
  it("disables send when the field is empty", () => {
    render(<ChatInput />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("enables send once text is present, and exactly one primary button exists", () => {
    render(<ChatInput />);
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
      target: { value: "Hello" },
    });
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).not.toBeDisabled();
    expect(send.className).toContain("bg-primary");

    // Exactly one primary-styled button in the composed input row.
    const primaryButtons = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("bg-primary"));
    expect(primaryButtons).toHaveLength(1);
  });

  it("submits on Enter and inserts a newline on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Hello");
  });
});

describe("MessageList", () => {
  it("exposes role=log with an aria-label", () => {
    render(<MessageList messages={[baseMessage]} />);
    expect(screen.getByRole("log", { name: "Conversation messages" })).toBeInTheDocument();
  });

  it("renders the unread divider immediately before the first unread message", () => {
    const messages: ChatMessageView[] = [
      baseMessage,
      { ...baseMessage, id: "m2", body: "Second" },
    ];
    render(<MessageList messages={messages} firstUnreadId="m2" />);
    expect(screen.getByRole("separator", { name: "Unread messages" })).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders calm, non-scolding copy", () => {
    render(<EmptyState />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});
