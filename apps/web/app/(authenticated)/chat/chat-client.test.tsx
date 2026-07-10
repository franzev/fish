import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientChatData } from "@/lib/services";
import { triggerIntersection } from "@/tests/intersection-observer";
import { ChatClient } from "./chat-client";
import { chatStore, resetChatStoreForTests } from "./store/chat-store";
import {
  selectReadStatesForConversation,
  selectRealtimeStatusForConversation,
} from "./store/chat-selectors";

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
  currentUserDisplayName: "Alex Rivera",
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

// Every realtime channel shares one mocked `channel` object, and
// `channel.subscribe`/`client.channel` mock call history accumulates across
// every test in this file (no clearMocks). Search from the end so a test
// captures the connection-status callback from its own latest subscribe
// call, not an earlier test's.
function latestSubscribeStatusCallback(
  channelSuffix: string
): (status: string) => void {
  const channelCalls = realtimeMock.client.channel.mock.calls;
  for (let index = channelCalls.length - 1; index >= 0; index -= 1) {
    const channelName = channelCalls[index]?.[0];
    if (typeof channelName === "string" && channelName.endsWith(channelSuffix)) {
      const callback = realtimeMock.channel.subscribe.mock.calls[index]?.[0];
      if (typeof callback === "function") {
        return callback as (status: string) => void;
      }
    }
  }

  throw new Error(
    `No subscribe callback captured for channel suffix "${channelSuffix}"`
  );
}

describe("ChatClient hook boundaries", () => {
  const chatClientSource = readFileSync(
    join(process.cwd(), "app/(authenticated)/chat/chat-client.tsx"),
    "utf8"
  );

  it("delegates message and read-state behavior to focused hooks", () => {
    expect(chatClientSource).toContain(`from "./hooks/use-chat-messages"`);
    expect(chatClientSource).toContain("useChatMessages(");
    expect(chatClientSource).toContain(`from "./hooks/use-chat-read-state"`);
    expect(chatClientSource).toContain("useChatReadState(");
  });

  it("delegates realtime and presence behavior to focused hooks", () => {
    expect(chatClientSource).toContain(`from "./hooks/use-chat-realtime"`);
    expect(chatClientSource).toContain("useChatRealtime(");
    expect(chatClientSource).toContain(`from "./hooks/use-chat-presence"`);
    expect(chatClientSource).toContain("useChatPresence(");
  });

  it("delegates composer command behavior to a focused hook", () => {
    expect(chatClientSource).toContain(`from "./hooks/use-chat-composer"`);
    expect(chatClientSource).toContain("useChatComposer(");
  });

  it("wires the rendering shell to narrow chat store selectors", () => {
    expect(chatClientSource).toContain(`from "./store/chat-selectors"`);
    expect(chatClientSource).toContain("selectComposerForConversation");
    expect(chatClientSource).toContain("selectReadStatesForConversation");
    expect(chatClientSource).not.toContain("useChatStore()");
  });

  it("keeps hook state transitions behind the chat store adapter", () => {
    const hookSources = [
      "use-chat-messages.ts",
      "use-chat-read-state.ts",
      "use-chat-realtime.ts",
      "use-chat-composer.ts",
    ].map((fileName) =>
      readFileSync(
        join(process.cwd(), `app/(authenticated)/chat/hooks/${fileName}`),
        "utf8"
      )
    );

    expect(hookSources.join("\n")).toContain("dispatchChatEvent");
    expect(hookSources.join("\n")).toContain("setDraft");
    expect(hookSources.join("\n")).toContain("sendOptimisticMessage");
    expect(hookSources.join("\n")).toContain("confirmSentMessage");
    expect(hookSources.join("\n")).toContain("markMessageFailed");
    expect(hookSources.join("\n")).toContain("mergeReadState");
  });

  it("resets every conversation-scoped realtime transient via a previousConversationId render-time comparison (WR-06)", () => {
    const useChatRealtimeSource = readFileSync(
      join(
        process.cwd(),
        "app/(authenticated)/chat/hooks/use-chat-realtime.ts"
      ),
      "utf8"
    );

    expect(useChatRealtimeSource).toContain("previousConversationId");
    expect(useChatRealtimeSource).toContain("setParticipantTyping(false)");
    expect(useChatRealtimeSource).toContain("setParticipantRecording(false)");
    expect(useChatRealtimeSource).toContain("setLocalRecording(false)");
    expect(useChatRealtimeSource).toContain("localTypingRef.current = false");
  });
});

describe("ChatClient", () => {
  beforeEach(() => {
    resetChatStoreForTests();
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

  it("renders the fixed demo conversation as a community room", () => {
    const communityChat: ClientChatData = {
      ...chat,
      kind: "community",
      channelId: "22222222-2222-4222-8222-222222222222",
      channelSlug: "general",
      channelName: "general",
      title: "general",
      participant: {
        id: chat.conversationId,
        displayName: "FISH Community",
        role: "coach",
      },
      messages: [
        {
          ...chat.messages[0],
          senderId: "client-2",
          senderRole: "client",
          senderDisplayName: "Sam Okafor",
          body: "Can anyone share a short intro?",
          clientRequestId: "seed-2",
        },
      ],
      participantPresence: undefined,
    };

    render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);

    expect(screen.getByLabelText("general room")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "# general" })).toBeInTheDocument();
    // Members derived from read states (client-1, coach-1) + sender (client-2).
    expect(screen.getByText("· 3 members")).toBeInTheDocument();
    expect(screen.getByText("Sam Okafor")).toBeInTheDocument();
    expect(screen.getByText("Can anyone share a short intro?")).toBeInTheDocument();
    expect(screen.getByLabelText("Community messages")).toBeInTheDocument();
  });

  it("renders a simplified channel header with a search field and no subtitle line", () => {
    const communityChat: ClientChatData = {
      ...chat,
      kind: "community",
      channelId: "22222222-2222-4222-8222-222222222222",
      channelSlug: "general",
      channelName: "general",
      title: "general",
      participant: {
        id: chat.conversationId,
        displayName: "FISH Community",
        role: "coach",
      },
      participantPresence: undefined,
    };

    render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /# general/i })).toBeInTheDocument();
    // The search field is always visible in the header now — no popover to
    // open before typing.
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });

  it("renders community rows as a left-aligned feed without direct-message bubbles", () => {
    const communityChat: ClientChatData = {
      ...chat,
      kind: "community",
      channelId: "22222222-2222-4222-8222-222222222222",
      channelSlug: "general",
      channelName: "general",
      title: "general",
      messages: [
        {
          ...chat.messages[0],
          senderId: "client-1",
          senderRole: "client",
          senderDisplayName: "Alex Rivera",
          body: "Hello everyone!",
          clientRequestId: "seed-own",
        },
      ],
      participantPresence: undefined,
    };

    render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);

    // Own messages join the shared feed with the author's display name, flat
    // monochrome text — never the mine-right primary bubble from direct chat.
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    const body = screen.getByText("Hello everyone!");
    expect(body.className).not.toContain("bg-primary");
    const row = body.closest("li");
    expect(row?.className).not.toContain("justify-end");
  });

  it("keeps new community author rows vertically balanced", () => {
    const communityChat: ClientChatData = {
      ...chat,
      kind: "community",
      channelId: "22222222-2222-4222-8222-222222222222",
      channelSlug: "general",
      channelName: "general",
      title: "general",
      messages: [
        chat.messages[0],
        {
          ...chat.messages[0],
          id: "message-2",
          senderId: "client-2",
          senderRole: "client",
          senderDisplayName: "Sam Okafor",
          body: "A second author starts here.",
          clientRequestId: "seed-second-author",
          createdAt: "2026-07-05T00:01:00.000Z",
          reactions: [{ emoji: "💙", count: 1, byMe: false }],
        },
      ],
      participantPresence: undefined,
    };

    render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);

    const row = screen.getByText("A second author starts here.").closest("li");
    expect(row).toHaveClass("py-sm");
    expect(row).not.toHaveClass("pt-sm");
  });

  it("shows community day dividers, coach role pill, and inline reply previews", () => {
    const communityChat: ClientChatData = {
      ...chat,
      kind: "community",
      channelId: "22222222-2222-4222-8222-222222222222",
      channelSlug: "general",
      channelName: "general",
      title: "general",
      messages: [
        {
          ...chat.messages[0],
          id: "message-1",
          senderId: "client-2",
          senderRole: "client",
          senderDisplayName: "Sam Okafor",
          body: "Can anyone share a short intro?",
          clientRequestId: "seed-1",
          createdAt: "2026-07-05T10:00:00.000Z",
        },
        {
          ...chat.messages[0],
          id: "message-2",
          senderId: "coach-1",
          senderRole: "coach",
          senderDisplayName: "Coach Dana",
          body: "Welcome! Introductions are a great place to start.",
          clientRequestId: "seed-2",
          createdAt: "2026-07-06T10:00:00.000Z",
          replyToMessageId: "message-1",
        },
      ],
      participantPresence: undefined,
    };

    render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);

    expect(screen.getByRole("separator")).toHaveTextContent("July 6, 2026");
    // Scoped to the feed so the assertion stays anchored to the coach role
    // pill on the message row, not any other "Coach" copy elsewhere.
    expect(
      within(screen.getByLabelText("Community messages")).getByText("Coach")
    ).toBeInTheDocument();
    // The reply preview restates the original author and snippet inline, so
    // both appear twice: once on the original message, once in the preview.
    expect(screen.getAllByText("Sam Okafor").length).toBeGreaterThan(1);
    expect(
      screen.getAllByText(/Can anyone share a short intro\?/).length
    ).toBeGreaterThan(1);
  });

  it("does not raise a notice when an unimplemented composer affordance is clicked", async () => {
    const communityChat: ClientChatData = {
      ...chat,
      kind: "community",
      channelId: "22222222-2222-4222-8222-222222222222",
      channelSlug: "general",
      channelName: "general",
      title: "general",
      participantPresence: undefined,
    };

    render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add a GIF" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("uses the plain Message placeholder in a direct chat (no channel idiom)", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(screen.getByPlaceholderText("Message")).toBeInTheDocument();
  });

  it("hides the Send button until the draft has content", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Hello" },
    });

    expect(
      screen.getByRole("button", { name: "Send message" })
    ).toBeInTheDocument();
  });

  it("does not show a recording indicator when Audio Recording is clicked", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Audio Recording" }));

    expect(screen.queryByText("Recording audio")).toBeNull();
  });

  it("uses the current server snapshot when the chat store has stale cached messages", () => {
    chatStore.getState().hydrateConversation(
      chat.conversationId,
      [
        {
          ...chat.messages[0],
          body: "Stale cached message",
          localStatus: "sent",
        },
      ],
      chat.readStates ?? [],
      "older-server-snapshot"
    );

    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(screen.getByText("How did practice feel today?")).toBeInTheDocument();
    expect(screen.queryByText("Stale cached message")).toBeNull();
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

  it("resets participant presence when the assigned participant changes without remounting", async () => {
    const { rerender } = render(
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

    rerender(
      <ChatClient
        chat={{
          ...chat,
          participant: {
            id: "coach-2",
            displayName: "Coach Lee",
            role: "coach",
          },
          participantPresence: {
            lastSeenAt: "2026-07-05T00:00:00.000Z",
            sessions: [],
          },
        }}
        sendMessageAction={vi.fn()}
      />
    );

    expect(screen.getByText("Coach Lee")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Active now")).toBeNull());
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
    expect(within(pendingItem).queryByRole("button", { name: "Add a reaction" })).toBeNull();
    expect(within(pendingItem).queryByRole("button", { name: "Edit message" })).toBeNull();
    expect(within(pendingItem).queryByRole("button", { name: "Delete message" })).toBeNull();
    expect(screen.queryByText("Sending")).toBeNull();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    // The draft cleared, so the conditional Send button leaves the bar —
    // there is no lingering busy/disabled Send while the action is pending.
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();

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

  it("restores the draft and offers retry when send fails", async () => {
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
    // The portable reducer restores the failed body to the composer draft
    // (nothing newer was typed) — the hook must not clobber that restore.
    // The restored draft and the failed bubble now share the same text, so
    // scope the bubble assertion to the log (the composer lives outside it).
    expect(screen.getByLabelText("Message")).toHaveValue("Please keep this draft.");
    const log = screen.getByRole("log", { name: "Conversation messages" });
    expect(within(log).getByText("Please keep this draft.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("preserves a newer draft when a delayed send failure arrives", async () => {
    type SendResult = {
      status: "notice";
      values: unknown;
      notice: string;
    };
    let resolveSend: (value: SendResult) => void = () => undefined;
    const sendMessageAction = vi.fn(
      () =>
        new Promise<SendResult>((resolve) => {
          resolveSend = resolve;
        })
    );

    render(<ChatClient chat={chat} sendMessageAction={sendMessageAction} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "First message." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("First message.")).toBeInTheDocument();
    // Eager pre-send clear still applies while the send is pending.
    expect(screen.getByLabelText("Message")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Second message." },
    });

    await act(async () => {
      resolveSend({
        status: "notice",
        values: {},
        notice: "That did not send yet. Keep this open and try again.",
      });
      await Promise.resolve();
    });

    expect(
      await screen.findByText("That did not send yet. Keep this open and try again.")
    ).toBeInTheDocument();
    // The newer draft survives — the delayed failure must not overwrite it.
    expect(screen.getByLabelText("Message")).toHaveValue("Second message.");

    const failedRow = screen.getByText("First message.").closest("li") as HTMLElement;
    expect(within(failedRow).getByRole("button", { name: "Retry" })).toBeInTheDocument();
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

    expect(screen.getByText("First grouped message").parentElement?.parentElement).toHaveClass(
      "rounded-br-chat-inner"
    );
    expect(
      screen.getByText("First grouped message").parentElement?.parentElement
    ).not.toHaveClass("rounded-tr-chat-inner");
    expect(screen.getByText("Middle grouped message").closest("li")).toHaveClass("mt-3xs");
    expect(screen.getByText("Middle grouped message").parentElement?.parentElement).toHaveClass(
      "rounded-tr-chat-inner",
      "rounded-br-chat-inner"
    );
    expect(screen.getByText("Last grouped message").closest("li")).toHaveClass("mt-3xs");
    expect(screen.getByText("Last grouped message").parentElement?.parentElement).toHaveClass(
      "rounded-tr-chat-inner"
    );
    expect(screen.getByText("Last grouped message").parentElement?.parentElement).not.toHaveClass(
      "rounded-br-chat-inner"
    );
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

    expect(screen.getByText("First received message").parentElement?.parentElement).toHaveClass(
      "rounded-bl-chat-inner"
    );
    expect(
      screen.getByText("First received message").parentElement?.parentElement
    ).not.toHaveClass("border", "border-border");
    expect(
      screen.getByText("First received message").parentElement?.parentElement
    ).not.toHaveClass("rounded-tl-chat-inner");
    expect(screen.getByText("Middle received message").closest("li")).toHaveClass("mt-3xs");
    expect(screen.getByText("Middle received message").parentElement?.parentElement).toHaveClass(
      "rounded-tl-chat-inner",
      "rounded-bl-chat-inner"
    );
    expect(
      screen.getByText("Middle received message").parentElement?.parentElement
    ).not.toHaveClass("border", "border-border");
    expect(screen.getByText("Last received message").closest("li")).toHaveClass("mt-3xs");
    expect(screen.getByText("Last received message").parentElement?.parentElement).toHaveClass(
      "rounded-tl-chat-inner"
    );
    expect(
      screen.getByText("Last received message").parentElement?.parentElement
    ).not.toHaveClass("border", "border-border");
    expect(
      screen.getByText("Last received message").parentElement?.parentElement
    ).not.toHaveClass("rounded-bl-chat-inner");
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

    // Open the emoji picker from the first message's "Add a reaction"
    // trigger, then search to a single result before clicking it — keeps
    // the rendered DOM small and deterministic in jsdom.
    fireEvent.click(screen.getAllByRole("button", { name: "Add a reaction" })[0]);
    fireEvent.change(screen.getByPlaceholderText("Search emoji"), {
      target: { value: "thumbs up" },
    });
    fireEvent.click(screen.getByRole("button", { name: "thumbs up" }));
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

  it("coalesces repeated realtime reaction events for the same message", async () => {
    const refreshMessagesAction = vi.fn().mockResolvedValue({
      status: "sent",
      values: {},
      messages: [],
    });

    render(
      <ChatClient
        chat={chat}
        sendMessageAction={vi.fn()}
        refreshMessagesAction={refreshMessagesAction}
      />
    );

    await waitFor(() => expect(realtimeMock.reactionHandlers).toHaveLength(1));

    act(() => {
      for (let index = 0; index < 5; index += 1) {
        realtimeMock.reactionHandlers[0]?.({
          eventType: "UPDATE",
          new: {
            message_id: "message-1",
            conversation_id: chat.conversationId,
          },
          old: {},
        });
      }
    });

    await waitFor(() => expect(refreshMessagesAction).toHaveBeenCalledTimes(1));
    expect(refreshMessagesAction).toHaveBeenCalledWith({
      messageIds: ["message-1"],
    });
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

  it("shows the quiet Load earlier messages button only when hasMoreOlder is true", () => {
    render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Load earlier messages" })
    ).toBeInTheDocument();
  });

  it("hides the Load earlier messages button when hasMoreOlder is false", () => {
    render(
      <ChatClient chat={{ ...chat, hasMoreOlder: false }} sendMessageAction={vi.fn()} />
    );

    expect(
      screen.queryByRole("button", { name: "Load earlier messages" })
    ).toBeNull();
  });

  it("auto-loads older history when the sentinel intersects, through the scroll-preserving path", async () => {
    const loadOlderMessagesAction = vi.fn().mockResolvedValue({
      status: "sent",
      values: {},
      messages: [
        {
          id: "message-0",
          conversationId: chat.conversationId,
          senderId: "coach-1",
          senderRole: "coach",
          body: "An older message from before.",
          clientRequestId: "seed-0",
          createdAt: "2026-07-04T00:00:00.000Z",
          editedAt: null,
          deletedAt: null,
          replyToMessageId: null,
          reactions: [],
        },
      ],
      hasMoreOlder: false,
    });

    render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    const sentinel = screen.getByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinel, true);
      await Promise.resolve();
    });

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("An older message from before.")
    ).toBeInTheDocument();
    // No duplicate: the existing seeded message still renders exactly once.
    expect(screen.getAllByText("How did practice feel today?")).toHaveLength(1);
  });

  it("bounds automatic load earlier retries after a failure while the sentinel stays visible", async () => {
    const loadOlderMessagesAction = vi.fn().mockResolvedValue({
      status: "notice",
      values: {},
      notice: "Earlier messages did not load.",
    });

    render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    const sentinel = screen.getByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinel, true);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.queryByTestId("load-older-skeleton")).toBeNull()
    );

    await act(async () => {
      triggerIntersection(sentinel, true);
      await Promise.resolve();
    });

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(1);
  });

  it("shows a calm notice-tone load earlier failure affordance without a duplicate action", async () => {
    const loadOlderMessagesAction = vi.fn().mockResolvedValue({
      status: "notice",
      values: {},
      notice: "Earlier messages did not load.",
    });

    render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    await act(async () => {
      triggerIntersection(screen.getByTestId("load-older-sentinel"), true);
      await Promise.resolve();
    });

    const error = await screen.findByTestId("load-older-error");
    expect(error).toHaveTextContent("Couldn't load earlier messages. Try again.");
    expect(screen.queryByTestId("load-older-skeleton")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Load earlier messages" })
    ).toBeNull();

    const retry = within(error).getByRole("button", { name: "Try again" });
    expect(retry).toHaveClass("min-h-control");
    expect(retry.className).toContain("bg-transparent");
    expect(retry.className).not.toContain("bg-primary");

    const alert = within(error)
      .getByText("Couldn't load earlier messages. Try again.")
      .closest("div");
    expect(alert).toHaveClass("border-border-strong");
    expect(alert).not.toHaveClass("border-error", "border-2");
  });

  it("retries load earlier manually and clears the notice when earlier history loads", async () => {
    const loadOlderMessagesAction = vi
      .fn()
      .mockResolvedValueOnce({
        status: "notice",
        values: {},
        notice: "Earlier messages did not load.",
      })
      .mockResolvedValueOnce({
        status: "sent",
        values: {},
        messages: [
          {
            ...chat.messages[0],
            id: "message-0",
            body: "Earlier history recovered.",
            clientRequestId: "seed-0",
            createdAt: "2026-07-04T00:00:00.000Z",
          },
        ],
        hasMoreOlder: false,
      });

    render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    await act(async () => {
      triggerIntersection(screen.getByTestId("load-older-sentinel"), true);
      await Promise.resolve();
    });

    const error = await screen.findByTestId("load-older-error");
    fireEvent.click(within(error).getByRole("button", { name: "Try again" }));

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Earlier history recovered.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("load-older-error")).toBeNull()
    );
  });

  it("keeps automatic load earlier available after a successful page when more history remains", async () => {
    const loadOlderMessagesAction = vi
      .fn()
      .mockResolvedValueOnce({
        status: "sent",
        values: {},
        messages: [
          {
            ...chat.messages[0],
            id: "message-0",
            body: "The first older page.",
            clientRequestId: "seed-0",
            createdAt: "2026-07-04T00:00:00.000Z",
          },
        ],
        hasMoreOlder: true,
      })
      .mockResolvedValueOnce({
        status: "sent",
        values: {},
        messages: [
          {
            ...chat.messages[0],
            id: "message-before-0",
            body: "The next older page.",
            clientRequestId: "seed-before-0",
            createdAt: "2026-07-03T00:00:00.000Z",
          },
        ],
        hasMoreOlder: false,
      });

    render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    let sentinel = screen.getByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinel, true);
      await Promise.resolve();
    });
    expect(await screen.findByText("The first older page.")).toBeInTheDocument();

    sentinel = screen.getByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinel, true);
      await Promise.resolve();
    });

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("The next older page.")).toBeInTheDocument();
  });

  it("resets the load earlier failure gate when the conversation changes", async () => {
    const loadOlderMessagesAction = vi.fn().mockResolvedValue({
      status: "notice",
      values: {},
      notice: "Earlier messages did not load.",
    });
    const { rerender } = render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    let sentinel = screen.getByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinel, true);
      await Promise.resolve();
    });
    await waitFor(() => expect(loadOlderMessagesAction).toHaveBeenCalledTimes(1));

    const nextConversationId = "22222222-2222-4222-8222-222222222222";
    rerender(
      <ChatClient
        chat={{
          ...chat,
          conversationId: nextConversationId,
          hasMoreOlder: true,
          messages: chat.messages.map((message) => ({
            ...message,
            conversationId: nextConversationId,
          })),
        }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    sentinel = await screen.findByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinel, true);
      await Promise.resolve();
    });

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(2);
    expect(loadOlderMessagesAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversationId: nextConversationId })
    );
  });

  it("does not let an in-flight load earlier request from conversation A suppress B's first load, and drops A's failure after the switch (WR-01)", async () => {
    type DeferredLoadOlderResult =
      | {
          status: "sent";
          values: unknown;
          messages: ClientChatData["messages"];
          hasMoreOlder: boolean;
        }
      | { status: "notice"; values: unknown; notice: string };

    const resolvers: Array<(value: DeferredLoadOlderResult) => void> = [];
    const loadOlderMessagesAction = vi.fn(
      () =>
        new Promise<DeferredLoadOlderResult>((resolve) => {
          resolvers.push(resolve);
        })
    );

    const { rerender } = render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    const sentinelA = screen.getByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinelA, true);
      await Promise.resolve();
    });

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(1);
    expect(loadOlderMessagesAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ conversationId: chat.conversationId })
    );

    // Switch the SAME mounted client to conversation B while A's request is
    // still unsettled.
    const nextConversationId = "22222222-2222-4222-8222-222222222222";
    rerender(
      <ChatClient
        chat={{
          ...chat,
          conversationId: nextConversationId,
          hasMoreOlder: true,
          messages: chat.messages.map((message) => ({
            ...message,
            conversationId: nextConversationId,
          })),
        }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    const sentinelB = await screen.findByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinelB, true);
      await Promise.resolve();
    });

    // B's first sentinel load was NOT suppressed by A's in-flight lock.
    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(2);
    expect(loadOlderMessagesAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ conversationId: nextConversationId })
    );

    // Settle A (the first call) as a failure AFTER the switch to B.
    await act(async () => {
      resolvers[0]?.({
        status: "notice",
        values: {},
        notice: "Earlier messages did not load.",
      });
      await Promise.resolve();
    });

    // A's failure did not write B's error state, and B's messages are intact.
    expect(screen.queryByTestId("load-older-error")).toBeNull();
    expect(screen.getByText("How did practice feel today?")).toBeInTheDocument();
  });

  it("does not merge a deferred conversation-A page into B's transcript after the switch (WR-01)", async () => {
    type DeferredLoadOlderResult =
      | {
          status: "sent";
          values: unknown;
          messages: ClientChatData["messages"];
          hasMoreOlder: boolean;
        }
      | { status: "notice"; values: unknown; notice: string };

    const resolvers: Array<(value: DeferredLoadOlderResult) => void> = [];
    const loadOlderMessagesAction = vi.fn(
      () =>
        new Promise<DeferredLoadOlderResult>((resolve) => {
          resolvers.push(resolve);
        })
    );

    const { rerender } = render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    const sentinelA = screen.getByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinelA, true);
      await Promise.resolve();
    });

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(1);

    const nextConversationId = "22222222-2222-4222-8222-222222222222";
    rerender(
      <ChatClient
        chat={{
          ...chat,
          conversationId: nextConversationId,
          hasMoreOlder: true,
          messages: chat.messages.map((message) => ({
            ...message,
            conversationId: nextConversationId,
          })),
        }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    const sentinelB = await screen.findByTestId("load-older-sentinel");
    await act(async () => {
      triggerIntersection(sentinelB, true);
      await Promise.resolve();
    });

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(2);

    // Settle A (the first call) as a SUCCESS, after the switch to B, with a
    // page body that only A should ever show.
    await act(async () => {
      resolvers[0]?.({
        status: "sent",
        values: {},
        messages: [
          {
            id: "message-a-only",
            conversationId: chat.conversationId,
            senderId: "coach-1",
            senderRole: "coach",
            body: "An A-only older message.",
            clientRequestId: "seed-a-only",
            createdAt: "2026-07-04T00:00:00.000Z",
            editedAt: null,
            deletedAt: null,
            replyToMessageId: null,
            reactions: [],
          },
        ],
        hasMoreOlder: false,
      });
      await Promise.resolve();
    });

    // A's page never lands in B's transcript; B's own state is unaffected.
    expect(screen.queryByText("An A-only older message.")).toBeNull();
    expect(screen.getByText("How did practice feel today?")).toBeInTheDocument();
  });

  it("drives the same wrapped scroll-preserving callback from the button as the sentinel", async () => {
    const loadOlderMessagesAction = vi.fn().mockResolvedValue({
      status: "sent",
      values: {},
      messages: [
        {
          id: "message-0",
          conversationId: chat.conversationId,
          senderId: "coach-1",
          senderRole: "coach",
          body: "Loaded via the button.",
          clientRequestId: "seed-0",
          createdAt: "2026-07-04T00:00:00.000Z",
          editedAt: null,
          deletedAt: null,
          replyToMessageId: null,
          reactions: [],
        },
      ],
      hasMoreOlder: false,
    });

    render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));

    expect(loadOlderMessagesAction).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Loaded via the button.")).toBeInTheDocument();
  });

  it("shows fixed-height skeleton rows while an older page loads, and removes them after", async () => {
    type LoadOlderResult = {
      status: "sent";
      values: unknown;
      messages: never[];
      hasMoreOlder: boolean;
    };
    let resolveLoad: (value: LoadOlderResult) => void = () => undefined;
    const loadOlderMessagesAction = vi.fn(
      () =>
        new Promise<LoadOlderResult>((resolve) => {
          resolveLoad = resolve;
        })
    );

    render(
      <ChatClient
        chat={{ ...chat, hasMoreOlder: true }}
        sendMessageAction={vi.fn()}
        loadOlderMessagesAction={loadOlderMessagesAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));

    expect(await screen.findByTestId("load-older-skeleton")).toBeInTheDocument();

    await act(async () => {
      resolveLoad({ status: "sent", values: {}, messages: [], hasMoreOlder: false });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.queryByTestId("load-older-skeleton")).toBeNull()
    );
  });

  it("shows a calm notice-tone offline state (never an error tone) when the realtime status is disconnected", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    act(() => {
      chatStore.getState().setRealtimeStatus(chat.conversationId, "disconnected");
    });

    // Truthful copy only (WR-03): no offline queue exists, so the banner
    // must never promise an automatic or background send.
    const banner = screen.getByText(/Reconnect, then try again\./);
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).not.toMatch(/will send when you're back/i);
  });

  it("re-shows the author name and avatar on a same-sender community message after the grouping gap", () => {
    const communityChat: ClientChatData = {
      ...chat,
      kind: "community",
      channelId: "22222222-2222-4222-8222-222222222222",
      channelSlug: "general",
      channelName: "general",
      title: "general",
      messages: [
        {
          ...chat.messages[0],
          id: "message-1",
          senderId: "client-2",
          senderRole: "client",
          senderDisplayName: "Sam Okafor",
          body: "First message in the run.",
          clientRequestId: "seed-1",
          createdAt: "2026-07-05T10:00:00.000Z",
        },
        {
          ...chat.messages[0],
          id: "message-2",
          senderId: "client-2",
          senderRole: "client",
          senderDisplayName: "Sam Okafor",
          // 10 minutes later — outside MESSAGE_GROUP_GAP_MS (5 min), so this
          // starts a fresh group even though the sender did not change.
          body: "Second message after the gap.",
          clientRequestId: "seed-2",
          createdAt: "2026-07-05T10:10:00.000Z",
        },
      ],
      participantPresence: undefined,
    };

    render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);

    // Both rows show the author's name (MessageMeta) and an avatar — the
    // gap ends the group, so identity/time are not suppressed on the later
    // same-sender message (closes WR-02).
    expect(screen.getAllByText("Sam Okafor").length).toBeGreaterThanOrEqual(2);
    const secondRow = screen
      .getByText("Second message after the gap.")
      .closest("li") as HTMLElement;
    expect(within(secondRow).getByText("Sam Okafor")).toBeInTheDocument();
    // Avatar initials ("SO") render again too — identity is not suppressed.
    expect(within(secondRow).getByText("SO")).toBeInTheDocument();
  });

  it("sizes revealed message-action controls to the 56px touch floor, not the old 40px size", async () => {
    render(
      <ChatClient
        chat={{
          ...chat,
          messages: [
            {
              ...chat.messages[0],
              senderId: "client-1",
              senderRole: "client",
              body: "A sent message with actions.",
              clientRequestId: "seed-actions",
            },
          ],
        }}
        sendMessageAction={vi.fn()}
        editMessageAction={vi.fn()}
        deleteMessageAction={vi.fn()}
      />
    );

    const reply = screen.getByRole("button", { name: "Reply to message" });
    const react = screen.getByRole("button", { name: "Add a reaction" });
    const edit = screen.getByRole("button", { name: "Edit message" });
    const remove = screen.getByRole("button", { name: "Delete message" });

    for (const action of [reply, react, edit, remove]) {
      expect(action.className).toContain("min-h-control");
      expect(action.className).toContain("min-w-control");
      expect(action.className).not.toContain("size-10");
    }
  });

  it("resets realtime status to idle on unmount so a revisit is not mislabeled as reconnecting", () => {
    const { unmount } = render(
      <ChatClient chat={chat} sendMessageAction={vi.fn()} />
    );

    act(() => {
      latestSubscribeStatusCallback(":messages")("SUBSCRIBED");
    });

    expect(
      selectRealtimeStatusForConversation(chatStore.getState(), chat.conversationId)
    ).toBe("connected");

    unmount();

    expect(
      selectRealtimeStatusForConversation(chatStore.getState(), chat.conversationId)
    ).toBe("idle");

    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    // An ordinary first connect on this fresh mount must never read as a
    // reconnect, even though the conversation genuinely connected before.
    expect(screen.queryByText("Reconnecting…")).toBeNull();
  });

  it("dispatches exactly one store transition per realtime read-state payload", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    let transitionCount = 0;
    const unsubscribe = chatStore.subscribe(() => {
      transitionCount += 1;
    });

    act(() => {
      realtimeMock.readHandlers[0]?.({
        new: {
          user_id: "coach-1",
          last_delivered_message_id: "message-1",
          delivered_at: "2026-07-05T00:02:00.000Z",
          last_read_message_id: "message-1",
          read_at: "2026-07-05T00:03:00.000Z",
        },
      });
    });

    unsubscribe();

    expect(transitionCount).toBe(1);
    expect(
      selectReadStatesForConversation(chatStore.getState(), chat.conversationId).find(
        (readState) => readState.userId === "coach-1"
      )
    ).toMatchObject({
      lastReadMessageId: "message-1",
      readAt: "2026-07-05T00:03:00.000Z",
    });
  });

  it("resets the participant typing indicator when a mounted client switches conversations (WR-06)", async () => {
    const { rerender } = render(
      <ChatClient chat={chat} sendMessageAction={vi.fn()} />
    );

    act(() => {
      realtimeMock.typingHandlers[0]?.({
        payload: { userId: "coach-1", typing: true },
      });
    });

    expect(
      await screen.findByRole("status", { name: "Coach Dana is typing" })
    ).toBeInTheDocument();

    const nextConversationId = "22222222-2222-4222-8222-222222222222";
    rerender(
      <ChatClient
        chat={{
          ...chat,
          conversationId: nextConversationId,
          messages: chat.messages.map((message) => ({
            ...message,
            conversationId: nextConversationId,
          })),
        }}
        sendMessageAction={vi.fn()}
      />
    );

    // A's typing indicator does not bleed into B, the freshly switched
    // conversation on the same mounted client.
    expect(screen.queryByText("Coach Dana is typing")).toBeNull();
    expect(
      screen.queryByRole("status", { name: "Coach Dana is typing" })
    ).toBeNull();
  });
});
