import { fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { useStickToBottom } from "./use-stick-to-bottom";
import type { LocalMessage } from "./use-chat-messages";

function makeMessage(id: string, overrides: Partial<LocalMessage> = {}): LocalMessage {
  return {
    id,
    conversationId: "conversation-1",
    senderId: "coach-1",
    senderRole: "coach",
    body: `body ${id}`,
    clientRequestId: `request-${id}`,
    createdAt: "2026-07-05T00:00:00.000Z",
    localStatus: "sent",
    ...overrides,
  };
}

/** Marks the mounted viewport node as either "near the bottom" (distance
 *  under the hook's threshold) or "far scrolled" (a reader mid-history), then
 *  fires the scroll event the hook listens on so its internal isNearBottomRef
 *  recomputes — jsdom does no real layout, so scroll geometry is stubbed. */
function markViewportPosition(node: HTMLDivElement, nearBottom: boolean) {
  Object.defineProperty(node, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(node, "clientHeight", { value: 500, configurable: true });
  Object.defineProperty(node, "scrollTop", {
    value: nearBottom ? 500 : 0,
    configurable: true,
  });
  fireEvent.scroll(node);
}

const stateHolder: { current: ReturnType<typeof useStickToBottom> | null } = {
  current: null,
};

interface HarnessProps {
  messages: LocalMessage[];
  currentUserId: string;
}

function Harness({ messages, currentUserId }: HarnessProps) {
  const state = useStickToBottom({ messages, currentUserId });
  stateHolder.current = state;
  return createElement("div", { ref: state.viewportRef });
}

describe("useStickToBottom", () => {
  it("follows a newly appended message to the bottom for a near-bottom reader", () => {
    const initialMessages = [makeMessage("message-1")];
    const { container, rerender } = render(
      createElement(Harness, { messages: initialMessages, currentUserId: "client-1" })
    );
    const viewport = container.firstElementChild as HTMLDivElement;
    markViewportPosition(viewport, true);

    const scrollToSpy = vi.spyOn(viewport, "scrollTo");

    const nextMessages = [
      ...initialMessages,
      makeMessage("message-2", { senderId: "coach-1" }),
    ];
    rerender(
      createElement(Harness, { messages: nextMessages, currentUserId: "client-1" })
    );

    expect(scrollToSpy).toHaveBeenCalled();
    expect(stateHolder.current?.showNewMessages).toBe(false);
  });

  it("ignores a prepended older page — same newest message, larger array", () => {
    const newest = makeMessage("message-2");
    const { container, rerender } = render(
      createElement(Harness, { messages: [newest], currentUserId: "client-1" })
    );
    const viewport = container.firstElementChild as HTMLDivElement;
    markViewportPosition(viewport, true);

    const scrollToSpy = vi.spyOn(viewport, "scrollTo");
    scrollToSpy.mockClear();

    // Older page prepended above; the newest message's identity is unchanged.
    const withOlderPage = [makeMessage("message-1"), newest];
    rerender(
      createElement(Harness, { messages: withOlderPage, currentUserId: "client-1" })
    );

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(stateHolder.current?.showNewMessages).toBe(false);
  });

  it("raises the pill (not an auto-scroll) for a far-scrolled reader receiving a new newest message", () => {
    const initialMessages = [makeMessage("message-1")];
    const { container, rerender } = render(
      createElement(Harness, { messages: initialMessages, currentUserId: "client-1" })
    );
    const viewport = container.firstElementChild as HTMLDivElement;
    markViewportPosition(viewport, false);

    const scrollToSpy = vi.spyOn(viewport, "scrollTo");
    scrollToSpy.mockClear();

    const nextMessages = [
      ...initialMessages,
      makeMessage("message-2", { senderId: "coach-1" }),
    ];
    rerender(
      createElement(Harness, { messages: nextMessages, currentUserId: "client-1" })
    );

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(stateHolder.current?.showNewMessages).toBe(true);
  });
});
