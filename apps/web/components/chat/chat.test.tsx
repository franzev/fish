import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTimeFormat } from "@/lib/prefs/apply-prefs";
import { Avatar } from "./avatar";
import { Bubble } from "./bubble";
import { ChatInput } from "./chat-input";
import { ConversationList, type ConversationSummary } from "./conversation-list";
import { EmptyState } from "./empty-state";
import { Message } from "./message";
import { MessageActions } from "./message-actions";
import { MessageList } from "./message-list";
import { MessageMeta } from "./message-meta";
import { MessageStatus } from "./message-status";
import { NotificationBadge } from "./notification-badge";
import { PresenceIndicator } from "./presence-indicator";
import { Reactions } from "./reactions";
import { TypingIndicator } from "./typing-indicator";
import type { ChatMessageView } from "./types";
import * as ChatKit from "./index";

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

describe("PresenceIndicator", () => {
  it("renders active presence with the online dot", () => {
    const { container } = render(
      <PresenceIndicator label="Active now" online showOnlineDot />
    );

    expect(screen.getByText("Active now")).toBeInTheDocument();
    expect(container.querySelector(".bg-success")).toBeInTheDocument();
  });

  it("renders last seen without an online dot", () => {
    const { container } = render(
      <PresenceIndicator
        label="Last seen yesterday at 8:15 PM"
        online={false}
        showOnlineDot={false}
      />
    );

    expect(screen.getByText("Last seen yesterday at 8:15 PM")).toBeInTheDocument();
    expect(container.querySelector(".bg-success")).toBeNull();
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
    // Own reaction reads by a heavier borderless fill step, not a border.
    expect(mine.className).toContain("bg-surface-3");
    expect(mine.className).not.toContain("border-border");

    const theirs = screen.getByRole("button", { name: /🎉 reaction, 1 person/ });
    expect(theirs).toHaveAttribute("aria-pressed", "false");
    expect(theirs.className).toContain("bg-surface-2");
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
    expect(getByText("Hi there")).toHaveClass(
      "rounded-tl-chat",
      "rounded-tr-chat",
      "rounded-bl-chat",
      "rounded-br-chat-inner"
    );
    expect(getByText("Hi there")).not.toHaveClass("rounded-card");

    rerender(<Bubble mine={false}>Hi there</Bubble>);
    expect(getByText("Hi there").className).toContain("bg-surface");
    expect(getByText("Hi there")).toHaveClass(
      "rounded-tl-chat",
      "rounded-tr-chat",
      "rounded-br-chat",
      "rounded-bl-chat-inner"
    );
    expect(getByText("Hi there")).not.toHaveClass("rounded-card");
    expect(getByText("Hi there").className).not.toContain("border ");
    expect(getByText("Hi there").className).not.toContain("border-border");
  });

  it("tightens both touching corners for grouped middle bubbles", () => {
    const { rerender, getByText } = render(
      <Bubble mine={false} groupedWithPrevious groupedWithNext>
        Grouped received
      </Bubble>
    );
    expect(getByText("Grouped received")).toHaveClass(
      "rounded-tl-chat-inner",
      "rounded-bl-chat-inner",
      "rounded-tr-chat",
      "rounded-br-chat"
    );

    rerender(
      <Bubble mine groupedWithPrevious groupedWithNext>
        Grouped mine
      </Bubble>
    );
    expect(getByText("Grouped mine")).toHaveClass(
      "rounded-tr-chat-inner",
      "rounded-br-chat-inner",
      "rounded-tl-chat",
      "rounded-bl-chat"
    );
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
    expect(container.firstChild).toHaveClass("justify-start");
  });

  it("aligns a sent (mine) message to the end", () => {
    const { container } = render(<Message message={{ ...baseMessage, mine: true }} />);
    expect(container.firstChild).toHaveClass("justify-end");
  });
});

describe("MessageMeta", () => {
  afterEach(() => {
    applyTimeFormat(null);
  });

  it("uses the saved 24-hour preference for the visible timestamp", () => {
    applyTimeFormat("24h");

    render(
      <MessageMeta
        authorName="Alex Rivera"
        sentAt="2026-07-05T13:05:00.000Z"
      />
    );

    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.queryByText(/\b(?:AM|PM)\b/i)).toBeNull();
  });

  it("uses the saved 12-hour preference for the visible timestamp", () => {
    applyTimeFormat("12h");

    render(
      <MessageMeta
        authorName="Alex Rivera"
        sentAt="2026-07-05T13:05:00.000Z"
      />
    );

    expect(screen.getByText(/\b(?:AM|PM)\b/i)).toBeInTheDocument();
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

  it("renders consecutive received messages as a tight connected stack", () => {
    const messages: ChatMessageView[] = [
      { ...baseMessage, id: "m1", body: "First received" },
      { ...baseMessage, id: "m2", body: "Middle received" },
      { ...baseMessage, id: "m3", body: "Last received" },
    ];
    render(<MessageList messages={messages} />);

    // Body text now renders through MessageBody, which wraps it in its own
    // block container inside the Bubble — two parent hops up from the text
    // reaches the Bubble div carrying the rounded-corner classes.
    expect(screen.getByText("First received").parentElement?.parentElement).toHaveClass(
      "rounded-tl-chat",
      "rounded-bl-chat-inner"
    );
    expect(screen.getByText("Middle received").parentElement?.parentElement).toHaveClass(
      "rounded-tl-chat-inner",
      "rounded-bl-chat-inner"
    );
    expect(screen.getByText("Last received").parentElement?.parentElement).toHaveClass(
      "rounded-tl-chat-inner",
      "rounded-bl-chat"
    );

    const middleWrapper =
      screen.getByText("Middle received").parentElement?.parentElement?.parentElement
        ?.parentElement?.parentElement;
    const lastWrapper =
      screen.getByText("Last received").parentElement?.parentElement?.parentElement
        ?.parentElement?.parentElement;
    expect(middleWrapper).toHaveClass("mt-3xs");
    expect(lastWrapper).toHaveClass("mt-3xs");
    expect(screen.getAllByText("AR")).toHaveLength(1);
    expect(within(lastWrapper as HTMLElement).getByText("AR")).toBeInTheDocument();
  });

  it("shows sent status only on the last bubble in a sent group", () => {
    const messages: ChatMessageView[] = [
      {
        ...baseMessage,
        id: "m1",
        author: { id: "u2", name: "Jordan Blake" },
        body: "First sent",
        mine: true,
        status: "sent",
      },
      {
        ...baseMessage,
        id: "m2",
        author: { id: "u2", name: "Jordan Blake" },
        body: "Last sent",
        mine: true,
        status: "delivered",
      },
    ];
    render(<MessageList messages={messages} />);

    expect(screen.queryByLabelText("Sent")).toBeNull();
    expect(screen.getByLabelText("Delivered")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders calm, non-scolding copy", () => {
    render(<EmptyState />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});

describe("NotificationBadge", () => {
  it("renders nothing at count 0", () => {
    const { container } = render(<NotificationBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when count is undefined", () => {
    const { container } = render(<NotificationBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("caps the visible count at 99+ but keeps the real count in the aria-label", () => {
    render(<NotificationBadge count={128} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByLabelText("128 unread messages")).toBeInTheDocument();
  });

  it("renders the exact count below the cap", () => {
    render(<NotificationBadge count={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByLabelText("3 unread messages")).toBeInTheDocument();
  });
});

const conversations: ConversationSummary[] = [
  {
    id: "c1",
    participant: { id: "u1", name: "Priya Nandan" },
    lastMessage: "See you next week",
    lastMessageAt: "9:10 AM",
    unreadCount: 2,
  },
  {
    id: "c2",
    participant: { id: "u2", name: "Sam Okafor" },
    lastMessage: "Thanks!",
    lastMessageAt: "Yesterday",
  },
];

describe("ConversationList", () => {
  it("filters rows by typed search text (case-insensitive)", () => {
    render(<ConversationList conversations={conversations} />);
    fireEvent.change(screen.getByLabelText("Search conversations"), {
      target: { value: "priya" },
    });
    expect(screen.getByRole("button", { name: /Priya Nandan/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sam Okafor/ })).not.toBeInTheDocument();
  });

  it("shows the calm 'No matches' state when nothing matches", () => {
    render(<ConversationList conversations={conversations} />);
    fireEvent.change(screen.getByLabelText("Search conversations"), {
      target: { value: "nobody" },
    });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });
});

describe("chat barrel export", () => {
  it("re-exports ChatContainer, ConversationList, and Bubble", () => {
    expect(ChatKit.ChatContainer).toBeDefined();
    expect(ChatKit.ConversationList).toBeDefined();
    expect(ChatKit.Bubble).toBeDefined();
  });
});
