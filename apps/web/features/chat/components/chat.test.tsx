import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTimeFormat } from "@/lib/prefs/apply-prefs";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "./avatar";
import { MessageMeta } from "./message-meta";
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
  it("uses the compact spacing token uniformly between reaction pills", () => {
    const { container } = render(
      <Reactions reactions={[{ emoji: "👍", count: 1, byMe: false }]} />
    );

    expect(container.firstElementChild).toHaveClass("gap-2xs");
    expect(container.firstElementChild).not.toHaveClass("gap-nudge");
  });

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
    expect(mine).toHaveClass(
      "min-h-control",
      "md:h-reaction-pill",
      "md:min-h-reaction-pill"
    );
    // Own reaction reads by a heavier borderless fill step, not a border.
    expect(mine.className).toContain("bg-surface-3");
    expect(mine.className).not.toContain("border-border");

    const theirs = screen.getByRole("button", { name: /🎉 reaction, 1 person/ });
    expect(theirs).toHaveAttribute("aria-pressed", "false");
    expect(theirs.className).toContain("bg-surface-2");
  });

  it("shows the reaction context in a tooltip", async () => {
    render(
      <Reactions
        reactions={[{ emoji: "🎉", count: 2, byMe: true }]}
        onToggle={() => undefined}
      />
    );

    fireEvent.focus(
      screen.getByRole("button", {
        name: "🎉 reaction, 2 people, including you",
      })
    );

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "🎉 reaction, 2 people, including you"
    );
  });

  it("keeps reaction context visible but inactive during message editing", () => {
    const onToggle = vi.fn();
    render(
      <Reactions
        reactions={[{ emoji: "👍", count: 2, byMe: true }]}
        onToggle={onToggle}
        disabled
      />
    );

    const reaction = screen.getByRole("button", { name: /including you/ });
    expect(reaction).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add a reaction" })).toBeNull();
    fireEvent.click(reaction);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("keeps only the reaction-row emoji picker visually compact", async () => {
    render(
      <Reactions
        reactions={[{ emoji: "👍", count: 1, byMe: false }]}
        onToggle={() => undefined}
      />
    );

    const reaction = screen.getByRole("button", { name: /👍 reaction/ });
    const trigger = screen.getByRole("button", { name: "Add a reaction" });
    const sharedGeometry = [
      "inline-flex",
      "min-h-control",
      "items-center",
      "rounded-pill",
      "px-xs",
      "py-2xs",
      "md:h-reaction-pill",
      "md:min-h-reaction-pill",
      "md:py-3xs",
    ];
    expect(reaction).toHaveClass(...sharedGeometry);
    expect(trigger).toHaveClass(...sharedGeometry);
    expect(trigger).not.toHaveClass("size-control");
    expect(trigger.querySelector("svg")).toHaveClass("tabler-icon-mood-plus");
    expect(trigger.querySelector("svg")).toHaveAttribute("width", "18");

    fireEvent.focus(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Add a reaction"
    );

    fireEvent.click(trigger);
    expect(
      await screen.findByRole("dialog", { name: "Choose an emoji" })
    ).toBeInTheDocument();
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

describe("EmptyState", () => {
  it("renders calm, non-scolding copy", () => {
    render(<EmptyState />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});
