import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientChatData } from "@/lib/services";
import { ChatClient } from "./chat-client";

const realtimeMock = vi.hoisted(() => {
  const messageHandlers: Array<(payload: { new: unknown }) => void> = [];
  const messageUpdateHandlers: Array<(payload: { new: unknown }) => void> = [];
  const readHandlers: Array<(payload: { new: unknown }) => void> = [];
  const reactionHandlers: Array<(payload: { eventType: string; new: unknown; old: unknown }) => void> = [];
  const presenceHandlers: Array<(payload: { eventType: string; new: unknown; old: unknown }) => void> = [];
  const typingHandlers: Array<
    (payload: { payload: { typing?: boolean; userId?: string } }) => void
  > = [];
  const voiceHandlers: Array<
    (payload: { payload: { recording?: boolean; userId?: string } }) => void
  > = [];
  const channel = {
    on: vi.fn(),
    send: vi.fn(),
    subscribe: vi.fn(),
  };
  const table = {
    upsert: vi.fn(),
  };
  const client = {
    channel: vi.fn(),
    removeChannel: vi.fn(),
    from: vi.fn(),
  };

  return {
    messageHandlers,
    messageUpdateHandlers,
    readHandlers,
    reactionHandlers,
    presenceHandlers,
    typingHandlers,
    voiceHandlers,
    channel,
    table,
    client,
  };
});

vi.mock("@/lib/services/supabase/browser", () => ({
  createBrowserSupabaseClient: () => realtimeMock.client,
}));

const chat: ClientChatData = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  currentUserId: "client-1",
  currentUserRole: "client",
  participant: {
    id: "coach-1",
    displayName: "Coach Dana",
    role: "coach",
  },
  messages: [
    {
      id: "message-1",
      conversationId: "11111111-1111-4111-8111-111111111111",
      senderId: "coach-1",
      senderRole: "coach",
      body: "How did practice feel today?",
      clientRequestId: "seed-1",
      createdAt: "2026-07-05T00:00:00.000Z",
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      reactions: [],
    },
  ],
  readStates: [
    {
      userId: "client-1",
      lastDeliveredMessageId: "message-1",
      deliveredAt: "2026-07-05T00:00:01.000Z",
      lastReadMessageId: null,
      readAt: null,
    },
    {
      userId: "coach-1",
      lastDeliveredMessageId: null,
      deliveredAt: null,
      lastReadMessageId: null,
      readAt: null,
    },
  ],
  participantPresence: {
    lastSeenAt: "2026-07-05T00:00:00.000Z",
    sessions: [],
  },
};

describe("ChatClient", () => {
  beforeEach(() => {
    realtimeMock.messageHandlers.length = 0;
    realtimeMock.messageUpdateHandlers.length = 0;
    realtimeMock.readHandlers.length = 0;
    realtimeMock.reactionHandlers.length = 0;
    realtimeMock.presenceHandlers.length = 0;
    realtimeMock.typingHandlers.length = 0;
    realtimeMock.voiceHandlers.length = 0;
    realtimeMock.channel.on.mockImplementation((event, filter, callback) => {
      if (event === "postgres_changes" && filter?.table === "messages") {
        if (filter?.event === "UPDATE") {
          realtimeMock.messageUpdateHandlers.push(
            callback as (payload: { new: unknown }) => void
          );
        } else {
          realtimeMock.messageHandlers.push(
            callback as (payload: { new: unknown }) => void
          );
        }
      }

      if (event === "postgres_changes" && filter?.table === "message_reads") {
        realtimeMock.readHandlers.push(callback as (payload: { new: unknown }) => void);
      }

      if (event === "postgres_changes" && filter?.table === "message_reactions") {
        realtimeMock.reactionHandlers.push(
          callback as (payload: { eventType: string; new: unknown; old: unknown }) => void
        );
      }

      if (event === "postgres_changes" && filter?.table === "presence_sessions") {
        realtimeMock.presenceHandlers.push(
          callback as (payload: { eventType: string; new: unknown; old: unknown }) => void
        );
      }

      if (event === "broadcast" && filter?.event === "typing") {
        realtimeMock.typingHandlers.push(
          callback as (payload: { payload: { typing?: boolean; userId?: string } }) => void
        );
      }

      if (event === "broadcast" && filter?.event === "voice-recording") {
        realtimeMock.voiceHandlers.push(
          callback as (payload: { payload: { recording?: boolean; userId?: string } }) => void
        );
      }

      return realtimeMock.channel;
    });
    realtimeMock.channel.send.mockResolvedValue("ok");
    realtimeMock.channel.subscribe.mockReturnValue(realtimeMock.channel);
    realtimeMock.client.channel.mockReturnValue(realtimeMock.channel);
    realtimeMock.client.removeChannel.mockResolvedValue(undefined);
    realtimeMock.table.upsert.mockResolvedValue({ data: null, error: null });
    realtimeMock.client.from.mockReturnValue(realtimeMock.table);
  });

  it("renders the direct assigned conversation without an inbox", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(screen.getByText("Coach Dana")).toBeInTheDocument();
    expect(screen.getByText("How did practice feel today?")).toBeInTheDocument();
    expect(screen.queryByLabelText(/search conversations/i)).toBeNull();
  });

  it("renders realtime presence directly below the participant name", () => {
    render(
      <ChatClient
        chat={{
          ...chat,
          participantPresence: {
            lastSeenAt: "2026-07-06T04:14:50.000Z",
            sessions: [
              {
                id: "presence-1",
                userId: "coach-1",
                activeAt: new Date().toISOString(),
                lastHeartbeatAt: new Date().toISOString(),
                endedAt: null,
              },
            ],
          },
        }}
        sendMessageAction={vi.fn()}
      />
    );

    expect(screen.getByText("Active now")).toBeInTheDocument();
    expect(screen.getByLabelText("Participant is online")).toHaveClass("bg-success");
  });

  it("shows the unread message counter until read state catches up", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(screen.getByLabelText("1 unread message")).toBeInTheDocument();
  });

  it("renders the participant avatar next to a received message bubble", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    const messageRow = screen.getByText("How did practice feel today?").closest("li");
    expect(messageRow).not.toBeNull();
    expect(within(messageRow as HTMLElement).getByText("CD")).toBeInTheDocument();
  });

  it("optimistically sends and clears the draft after success", async () => {
    const sendMessageAction = vi.fn().mockImplementationOnce((input: unknown) => {
      const request = input as { clientRequestId: string };

      return Promise.resolve({
        status: "sent",
        values: {},
        message: {
          id: "message-2",
          conversationId: chat.conversationId,
          senderId: "client-1",
          senderRole: "client",
          body: "It felt steady.",
          clientRequestId: request.clientRequestId,
          createdAt: "2026-07-05T00:01:00.000Z",
          editedAt: null,
          deletedAt: null,
          replyToMessageId: null,
          reactions: [],
        },
      });
    });

    render(<ChatClient chat={chat} sendMessageAction={sendMessageAction} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "It felt steady." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("It felt steady.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Sent")).toBeInTheDocument());
    expect(screen.queryByText("Sent")).toBeNull();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(sendMessageAction).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: chat.conversationId,
        body: "It felt steady.",
      })
    );
  });

  it("keeps optimistic sends visually fluid while the server action is pending", async () => {
    const sendMessageAction = vi.fn(
      () => new Promise<never>(() => undefined)
    );

    render(<ChatClient chat={chat} sendMessageAction={sendMessageAction} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "This should feel instant." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const log = screen.getByRole("log", { name: "Conversation messages" });
    const messageRow = await within(log).findByText("This should feel instant.");
    expect(messageRow).toBeInTheDocument();
    const pendingItem = messageRow.closest("li") as HTMLElement;
    expect(within(pendingItem).queryByRole("button", { name: "Reply to message" })).toBeNull();
    expect(within(pendingItem).queryByRole("button", { name: "React with thumbs up" })).toBeNull();
    expect(within(pendingItem).queryByRole("button", { name: "Edit message" })).toBeNull();
    expect(within(pendingItem).queryByRole("button", { name: "Delete message" })).toBeNull();
    expect(screen.queryByText("Sending")).toBeNull();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Send message" })).not.toHaveAttribute(
      "aria-busy",
      "true"
    );

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Another quick one." },
    });

    expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Send message" })).not.toHaveAttribute(
      "aria-busy",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await within(log).findByText("Another quick one.")).toBeInTheDocument();
    expect(sendMessageAction).toHaveBeenCalledTimes(2);
  });

  it("clears the composer and offers retry when send fails", async () => {
    const sendMessageAction = vi.fn().mockResolvedValue({
      status: "notice",
      values: {},
      notice: "That did not send yet. Keep this open and try again.",
    });

    render(<ChatClient chat={chat} sendMessageAction={sendMessageAction} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Please keep this draft." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByText("That did not send yet. Keep this open and try again.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(screen.getByText("Please keep this draft.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows one compact sent status on the latest outgoing message only", () => {
    render(
      <ChatClient
        chat={{
          ...chat,
          messages: [
            ...chat.messages,
            {
              id: "message-2",
              conversationId: chat.conversationId,
              senderId: "client-1",
              senderRole: "client",
              body: "First conflict probe",
              clientRequestId: "seed-2",
              createdAt: "2026-07-05T00:01:00.000Z",
            },
            {
              id: "message-3",
              conversationId: chat.conversationId,
              senderId: "client-1",
              senderRole: "client",
              body: "Immutable message probe",
              clientRequestId: "seed-3",
              createdAt: "2026-07-05T00:02:00.000Z",
            },
          ],
        }}
        sendMessageAction={vi.fn()}
      />
    );

    const statuses = screen.getAllByLabelText("Sent");
    expect(statuses).toHaveLength(1);
    expect(statuses[0].closest("li")).toHaveTextContent("Immutable message probe");
    expect(screen.queryByText("Sent")).toBeNull();
  });

  it("connects consecutive outgoing bubbles with small internal end corners", () => {
    render(
      <ChatClient
        chat={{
          ...chat,
          messages: [
            ...chat.messages,
            {
              id: "message-2",
              conversationId: chat.conversationId,
              senderId: "client-1",
              senderRole: "client",
              body: "First grouped message",
              clientRequestId: "seed-2",
              createdAt: "2026-07-05T00:01:00.000Z",
            },
            {
              id: "message-3",
              conversationId: chat.conversationId,
              senderId: "client-1",
              senderRole: "client",
              body: "Middle grouped message",
              clientRequestId: "seed-3",
              createdAt: "2026-07-05T00:02:00.000Z",
            },
            {
              id: "message-4",
              conversationId: chat.conversationId,
              senderId: "client-1",
              senderRole: "client",
              body: "Last grouped message",
              clientRequestId: "seed-4",
              createdAt: "2026-07-05T00:03:00.000Z",
            },
          ],
        }}
        sendMessageAction={vi.fn()}
      />
    );

    expect(screen.getByText("First grouped message")).toHaveClass("rounded-br-chat-inner");
    expect(screen.getByText("First grouped message")).not.toHaveClass("rounded-tr-chat-inner");
    expect(screen.getByText("Middle grouped message").closest("li")).toHaveClass("mt-3xs");
    expect(screen.getByText("Middle grouped message")).toHaveClass(
      "rounded-tr-chat-inner",
      "rounded-br-chat-inner"
    );
    expect(screen.getByText("Last grouped message").closest("li")).toHaveClass("mt-3xs");
    expect(screen.getByText("Last grouped message")).toHaveClass("rounded-tr-chat-inner");
    expect(screen.getByText("Last grouped message")).not.toHaveClass("rounded-br-chat-inner");
  });

  it("connects consecutive received bubbles with small internal start corners", () => {
    render(
      <ChatClient
        chat={{
          ...chat,
          messages: [
            {
              ...chat.messages[0],
              body: "First received message",
            },
            {
              id: "message-2",
              conversationId: chat.conversationId,
              senderId: "coach-1",
              senderRole: "coach",
              body: "Middle received message",
              clientRequestId: "seed-2",
              createdAt: "2026-07-05T00:01:00.000Z",
            },
            {
              id: "message-3",
              conversationId: chat.conversationId,
              senderId: "coach-1",
              senderRole: "coach",
              body: "Last received message",
              clientRequestId: "seed-3",
              createdAt: "2026-07-05T00:02:00.000Z",
            },
          ],
        }}
        sendMessageAction={vi.fn()}
      />
    );

    expect(screen.getByText("First received message")).toHaveClass("rounded-bl-chat-inner");
    expect(screen.getByText("First received message")).not.toHaveClass(
      "border",
      "border-border"
    );
    expect(screen.getByText("First received message")).not.toHaveClass("rounded-tl-chat-inner");
    expect(screen.getByText("Middle received message").closest("li")).toHaveClass("mt-3xs");
    expect(screen.getByText("Middle received message")).toHaveClass(
      "rounded-tl-chat-inner",
      "rounded-bl-chat-inner"
    );
    expect(screen.getByText("Middle received message")).not.toHaveClass(
      "border",
      "border-border"
    );
    expect(screen.getByText("Last received message").closest("li")).toHaveClass("mt-3xs");
    expect(screen.getByText("Last received message")).toHaveClass("rounded-tl-chat-inner");
    expect(screen.getByText("Last received message")).not.toHaveClass(
      "border",
      "border-border"
    );
    expect(screen.getByText("Last received message")).not.toHaveClass("rounded-bl-chat-inner");
  });

  it("shows animated typing dots when the participant is typing", async () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(realtimeMock.client.channel).toHaveBeenCalledWith(
      `conversation:${chat.conversationId}:typing`,
      expect.objectContaining({
        config: expect.objectContaining({
          broadcast: expect.objectContaining({ self: false }),
        }),
      })
    );
    expect(realtimeMock.typingHandlers).toHaveLength(1);

    act(() => {
      realtimeMock.typingHandlers[0]?.({
        payload: {
          userId: "coach-1",
          typing: true,
        },
      });
    });

    const typing = await screen.findByRole("status", {
      name: "Coach Dana is typing",
    });
    expect(typing.querySelectorAll(".animate-typing")).toHaveLength(3);
    expect(screen.getByText("Coach Dana is typing")).toBeInTheDocument();
  });

  it("shows the voice recording indicator when the participant is recording", async () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(realtimeMock.voiceHandlers).toHaveLength(1);

    act(() => {
      realtimeMock.voiceHandlers[0]?.({
        payload: {
          userId: "coach-1",
          recording: true,
        },
      });
    });

    expect(await screen.findByText("Coach Dana is recording audio")).toBeInTheDocument();
  });

  it("sends a reply with the selected replied-to message id", async () => {
    const sendMessageAction = vi.fn().mockResolvedValueOnce({
      status: "sent",
      values: {},
      message: {
        id: "message-2",
        conversationId: chat.conversationId,
        senderId: "client-1",
        senderRole: "client",
        body: "It felt steady.",
        clientRequestId: "reply-request",
        createdAt: "2026-07-05T00:01:00.000Z",
        editedAt: null,
        deletedAt: null,
        replyToMessageId: "message-1",
        reactions: [],
      },
    });

    render(<ChatClient chat={chat} sendMessageAction={sendMessageAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Reply to message" }));
    expect(screen.getByText("Replying to Coach Dana")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "It felt steady." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(sendMessageAction).toHaveBeenCalledWith(
        expect.objectContaining({
          replyToMessageId: "message-1",
        })
      )
    );
  });

  it("edits and deletes the current user's messages through quiet actions", async () => {
    const editMessageAction = vi.fn().mockResolvedValue({
      status: "sent",
      values: {},
      message: {
        id: "message-2",
        conversationId: chat.conversationId,
        senderId: "client-1",
        senderRole: "client",
        body: "Edited text.",
        clientRequestId: "seed-2",
        createdAt: "2026-07-05T00:01:00.000Z",
        editedAt: "2026-07-05T00:02:00.000Z",
        deletedAt: null,
        replyToMessageId: null,
        reactions: [],
      },
    });
    const deleteMessageAction = vi.fn().mockResolvedValue({
      status: "sent",
      values: {},
      message: {
        id: "message-2",
        conversationId: chat.conversationId,
        senderId: "client-1",
        senderRole: "client",
        body: "",
        clientRequestId: "seed-2",
        createdAt: "2026-07-05T00:01:00.000Z",
        editedAt: null,
        deletedAt: "2026-07-05T00:03:00.000Z",
        replyToMessageId: null,
        reactions: [],
      },
    });

    render(
      <ChatClient
        chat={{
          ...chat,
          messages: [
            ...chat.messages,
            {
              id: "message-2",
              conversationId: chat.conversationId,
              senderId: "client-1",
              senderRole: "client",
              body: "Original text.",
              clientRequestId: "seed-2",
              createdAt: "2026-07-05T00:01:00.000Z",
              editedAt: null,
              deletedAt: null,
              replyToMessageId: null,
              reactions: [],
            },
          ],
        }}
        sendMessageAction={vi.fn()}
        editMessageAction={editMessageAction}
        deleteMessageAction={deleteMessageAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    expect(screen.getByLabelText("Message")).toHaveValue("Original text.");
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Edited text." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(editMessageAction).toHaveBeenCalledWith({
        messageId: "message-2",
        body: "Edited text.",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));
    await waitFor(() =>
      expect(deleteMessageAction).toHaveBeenCalledWith({ messageId: "message-2" })
    );
  });

  it("toggles reactions and updates read receipts from realtime", async () => {
    const toggleReactionAction = vi.fn().mockResolvedValue({
      status: "sent",
      values: {},
      message: {
        ...chat.messages[0],
        reactions: [{ emoji: "👍", count: 1, byMe: true }],
      },
    });

    render(
      <ChatClient
        chat={{
          ...chat,
          messages: [
            ...chat.messages,
            {
              id: "message-2",
              conversationId: chat.conversationId,
              senderId: "client-1",
              senderRole: "client",
              body: "Outgoing.",
              clientRequestId: "seed-2",
              createdAt: "2026-07-05T00:01:00.000Z",
              editedAt: null,
              deletedAt: null,
              replyToMessageId: null,
              reactions: [],
            },
          ],
        }}
        sendMessageAction={vi.fn()}
        toggleReactionAction={toggleReactionAction}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "React with thumbs up" })[0]);
    await waitFor(() =>
      expect(toggleReactionAction).toHaveBeenCalledWith({
        messageId: "message-1",
        emoji: "👍",
      })
    );

    act(() => {
      realtimeMock.readHandlers[0]?.({
        new: {
          user_id: "coach-1",
          last_delivered_message_id: "message-2",
          delivered_at: "2026-07-05T00:02:00.000Z",
          last_read_message_id: "message-2",
          read_at: "2026-07-05T00:03:00.000Z",
        },
      });
    });

    expect(await screen.findByLabelText("Read")).toBeInTheDocument();
  });

  it("sends the message when Enter is pressed in the message field", async () => {
    const sendMessageAction = vi.fn().mockResolvedValueOnce({
      status: "sent",
      values: {},
      message: {
        id: "message-2",
        conversationId: chat.conversationId,
        senderId: "client-1",
        senderRole: "client",
        body: "Enter sends this.",
        clientRequestId: "local-request",
        createdAt: "2026-07-05T00:01:00.000Z",
      },
    });

    render(<ChatClient chat={chat} sendMessageAction={sendMessageAction} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Enter sends this." },
    });
    fireEvent.keyDown(screen.getByLabelText("Message"), {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() =>
      expect(sendMessageAction).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: chat.conversationId,
          body: "Enter sends this.",
        })
      )
    );
  });

  it("displays new messages received through realtime", async () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(realtimeMock.client.channel).toHaveBeenCalledWith(
      `conversation:${chat.conversationId}:messages`
    );
    expect(realtimeMock.channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${chat.conversationId}`,
      },
      expect.any(Function)
    );

    act(() => {
      realtimeMock.messageHandlers[0]?.({
        new: {
          id: "message-2",
          conversation_id: chat.conversationId,
          sender_id: "coach-1",
          sender_role: "coach",
          body: "Nice work today.",
          client_request_id: "seed-2",
          created_at: "2026-07-05T00:02:00.000Z",
        },
      });
    });

    expect(await screen.findByText("Nice work today.")).toBeInTheDocument();
  });
});
