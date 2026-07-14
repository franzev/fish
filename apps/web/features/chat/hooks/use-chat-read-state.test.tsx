import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClientChatData,
  ClientChatReadState,
  MarkReadStateInput,
} from "@/lib/services";
import { chatStore, resetChatStoreForTests } from "@/features/chat/model/store";
import type { MarkReadStateActionState } from "@/features/chat/contracts";
import type { LocalMessage } from "./use-chat-messages";
import { useChatReadState } from "./use-chat-read-state";

const conversationId = "11111111-1111-4111-8111-111111111111";
const firstMessage: LocalMessage = {
  id: "message-1",
  conversationId,
  senderId: "coach-1",
  senderRole: "coach",
  body: "First unread message",
  clientRequestId: "request-1",
  createdAt: "2026-07-14T07:25:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  localStatus: "sent",
};
const initialReadState: ClientChatReadState = {
  userId: "client-1",
  lastDeliveredMessageId: null,
  deliveredAt: null,
  lastReadMessageId: null,
  readAt: null,
};
const chat: ClientChatData = {
  conversationId,
  currentUserId: "client-1",
  currentUserRole: "client",
  currentUserDisplayName: "Alex Rivera",
  participant: {
    id: "coach-1",
    displayName: "Coach Dana",
    role: "coach",
  },
  messages: [firstMessage],
  readStates: [initialReadState],
  unreadSummary: {
    count: 1,
    oldestUnreadAt: firstMessage.createdAt,
    latestUnreadMessageId: firstMessage.id,
  },
};

function readStateFor(input: MarkReadStateInput): ClientChatReadState {
  return {
    userId: chat.currentUserId,
    lastDeliveredMessageId: input.lastDeliveredMessageId,
    deliveredAt: input.lastDeliveredMessageId
      ? "2026-07-14T07:30:00.000Z"
      : null,
    lastReadMessageId: input.lastReadMessageId,
    readAt: input.lastReadMessageId ? "2026-07-14T07:30:01.000Z" : null,
  };
}

interface HarnessProps {
  messages?: LocalMessage[];
  markReadStateAction: (
    input: unknown
  ) => Promise<MarkReadStateActionState>;
}

function Harness({
  messages = [firstMessage],
  markReadStateAction,
}: HarnessProps) {
  const state = useChatReadState({ chat, messages, markReadStateAction });
  return (
    <div>
      <span data-testid="unread-count">{state.unreadSummary.count}</span>
      <span data-testid="read-notice">{state.unreadNotice}</span>
      <button
        type="button"
        onClick={() => void state.markUnreadMessagesRead()}
      >
        Mark as read
      </button>
    </div>
  );
}

beforeEach(() => {
  resetChatStoreForTests();
});

describe("useChatReadState", () => {
  it("marks incoming messages delivered on mount without marking them read", async () => {
    const markReadStateAction = vi.fn(async (value: unknown) => {
      const input = value as MarkReadStateInput;
      return {
        status: "sent" as const,
        values: input,
        readState: readStateFor(input),
      };
    });

    render(<Harness markReadStateAction={markReadStateAction} />);

    await waitFor(() => expect(markReadStateAction).toHaveBeenCalledTimes(1));
    expect(markReadStateAction).toHaveBeenCalledWith({
      conversationId,
      lastDeliveredMessageId: "message-1",
      lastReadMessageId: null,
    });
    expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
  });

  it("hides unread messages immediately while persisting the read marker", async () => {
    let resolveRead!: (result: MarkReadStateActionState) => void;
    const pendingRead = new Promise<MarkReadStateActionState>((resolve) => {
      resolveRead = resolve;
    });
    const markReadStateAction = vi.fn((value: unknown) => {
      const input = value as MarkReadStateInput;
      return input.lastReadMessageId
        ? pendingRead
        : Promise.resolve({
            status: "sent" as const,
            values: input,
            readState: readStateFor(input),
          });
    });

    render(<Harness markReadStateAction={markReadStateAction} />);
    await waitFor(() => expect(markReadStateAction).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));

    expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
    expect(markReadStateAction).toHaveBeenNthCalledWith(2, {
      conversationId,
      lastDeliveredMessageId: "message-1",
      lastReadMessageId: "message-1",
    });

    await act(async () => {
      resolveRead({
        status: "sent",
        values: {},
        readState: readStateFor({
          conversationId,
          lastDeliveredMessageId: "message-1",
          lastReadMessageId: "message-1",
        }),
      });
      await pendingRead;
    });
    expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
  });

  it("keeps unread state visible with calm guidance when marking fails", async () => {
    const markReadStateAction = vi.fn(async (value: unknown) => {
      const input = value as MarkReadStateInput;
      return input.lastReadMessageId
        ? {
            status: "notice" as const,
            values: input,
            notice: "temporary failure",
          }
        : {
            status: "sent" as const,
            values: input,
            readState: readStateFor(input),
          };
    });

    render(<Harness markReadStateAction={markReadStateAction} />);
    await waitFor(() => expect(markReadStateAction).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));

    expect(await screen.findByTestId("read-notice")).toHaveTextContent(
      "Messages weren’t marked as read. Try again."
    );
    expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
  });

  it("does not acknowledge a message that arrives while marking is in flight", async () => {
    let resolveRead!: (result: MarkReadStateActionState) => void;
    const pendingRead = new Promise<MarkReadStateActionState>((resolve) => {
      resolveRead = resolve;
    });
    const markReadStateAction = vi.fn((value: unknown) => {
      const input = value as MarkReadStateInput;
      return input.lastReadMessageId
        ? pendingRead
        : Promise.resolve({
            status: "sent" as const,
            values: input,
            readState: readStateFor(input),
          });
    });
    const secondMessage: LocalMessage = {
      ...firstMessage,
      id: "message-2",
      clientRequestId: "request-2",
      body: "Arrived during the request",
      createdAt: "2026-07-14T07:31:00.000Z",
    };

    const { rerender } = render(
      <Harness markReadStateAction={markReadStateAction} />
    );
    await waitFor(() => expect(markReadStateAction).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(markReadStateAction).toHaveBeenCalledTimes(2));

    act(() => {
      chatStore.getState().hydrateConversation(
        conversationId,
        [firstMessage, secondMessage],
        [initialReadState]
      );
    });
    rerender(
      <Harness
        messages={[firstMessage, secondMessage]}
        markReadStateAction={markReadStateAction}
      />
    );
    await act(async () => {
      resolveRead({
        status: "sent",
        values: {},
        readState: readStateFor({
          conversationId,
          lastDeliveredMessageId: "message-1",
          lastReadMessageId: "message-1",
        }),
      });
      await pendingRead;
    });

    await waitFor(() => expect(screen.getByTestId("unread-count")).toHaveTextContent("1"));
  });

  it("ignores a stale delivered-only response after a newer read result", async () => {
    let resolveDelivery!: (result: MarkReadStateActionState) => void;
    const pendingDelivery = new Promise<MarkReadStateActionState>((resolve) => {
      resolveDelivery = resolve;
    });
    const markReadStateAction = vi.fn((value: unknown) => {
      const input = value as MarkReadStateInput;
      return input.lastReadMessageId
        ? Promise.resolve({
            status: "sent" as const,
            values: input,
            readState: readStateFor(input),
          })
        : pendingDelivery;
    });

    render(<Harness markReadStateAction={markReadStateAction} />);
    await waitFor(() => expect(markReadStateAction).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(screen.getByTestId("unread-count")).toHaveTextContent("0"));

    await act(async () => {
      resolveDelivery({
        status: "sent",
        values: {},
        readState: readStateFor({
          conversationId,
          lastDeliveredMessageId: "message-1",
          lastReadMessageId: null,
        }),
      });
      await pendingDelivery;
    });

    expect(
      chatStore.getState().conversations[conversationId]?.readStates[0]
        ?.lastReadMessageId
    ).toBe("message-1");
  });
});
