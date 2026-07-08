"use client";

import { ChatClient } from "@/app/(authenticated)/chat/chat-client";
import type { SendMessageActionState } from "@/app/(authenticated)/chat/actions";
import type { ClientChatData, ClientChatMessage } from "@/lib/services";

/* Dev-only harness: the REAL ChatClient (shell-sized, scroll container,
   hover bars) with mock data and stubbed actions, so chat-interior changes
   can be verified without auth. The kit's ChatContainer is a different
   component tree — verifying there alone misses this DOM context. */

const conversationId = "00000000-0000-4000-8000-00000000c0de";
const you = "user-you";

let now = Date.parse("2026-07-08T16:00:00.000Z");
const nextTime = () => new Date((now += 60_000)).toISOString();

function mockMessage(
  overrides: Partial<ClientChatMessage> &
    Pick<ClientChatMessage, "id" | "senderId" | "body">
): ClientChatMessage {
  return {
    conversationId,
    senderRole: "client",
    clientRequestId: overrides.id,
    createdAt: nextTime(),
    editedAt: null,
    deletedAt: null,
    replyToMessageId: null,
    reactions: [],
    ...overrides,
  };
}

const messages: ClientChatMessage[] = [
  mockMessage({
    id: "m1",
    senderId: "user-sam",
    senderDisplayName: "Sam Okafor",
    body: "Morning everyone — quick question about yesterday's phrasing exercise.",
  }),
  mockMessage({
    id: "m2",
    senderId: "user-jordan",
    senderRole: "coach",
    senderDisplayName: "Coach Jordan",
    body: "hahahaha",
    reactions: [{ emoji: "👍", count: 2, byMe: true }],
  }),
  mockMessage({
    id: "m3",
    senderId: "user-sam",
    senderDisplayName: "Sam Okafor",
    body: "Do we say 'on the meeting' or 'in the meeting'?",
  }),
  mockMessage({
    id: "m4",
    senderId: "user-jordan",
    senderRole: "coach",
    senderDisplayName: "Coach Jordan",
    body: "'In the meeting' — prepositions of place take practice, nice catch.",
    reactions: [
      { emoji: "🎉", count: 1, byMe: false },
      { emoji: "🙏", count: 3, byMe: true },
    ],
  }),
  mockMessage({ id: "m5", senderId: you, body: "asfasf" }),
  mockMessage({
    id: "m6",
    senderId: "user-sam",
    senderDisplayName: "Sam Okafor",
    body: "Thanks! That helps a lot.",
  }),
  mockMessage({
    id: "m7",
    senderId: you,
    body: "Same here — writing it down now.",
    reactions: [{ emoji: "❤️", count: 1, byMe: false }],
  }),
];

const chat: ClientChatData = {
  conversationId,
  kind: "community",
  title: "Community",
  subtitle: "4 members",
  currentUserId: you,
  currentUserRole: "coach",
  participant: { id: "user-jordan", displayName: "Coach Jordan", role: "coach" },
  messages,
  readStates: [],
};

/* Mimics the server ack shape: the bare message row, WITHOUT
   senderDisplayName — the case that used to blank names to "Member". */
function ackFor(
  message: ClientChatMessage,
  reactions: ClientChatMessage["reactions"]
): SendMessageActionState {
  return {
    status: "sent",
    values: {},
    message: { ...message, senderDisplayName: null, reactions },
  };
}

async function toggleReactionStub(input: unknown): Promise<SendMessageActionState> {
  const { messageId, emoji } = input as { messageId: string; emoji: string };
  const message = messages.find((entry) => entry.id === messageId);
  if (!message) {
    return { status: "notice", values: {}, notice: "That reaction is not available." };
  }
  const current = message.reactions ?? [];
  const existing = current.find((reaction) => reaction.emoji === emoji);
  const nextReactions = existing
    ? current
        .map((reaction) =>
          reaction.emoji === emoji
            ? {
                ...reaction,
                byMe: !reaction.byMe,
                count: reaction.count + (reaction.byMe ? -1 : 1),
              }
            : reaction
        )
        .filter((reaction) => reaction.count > 0)
    : [...current, { emoji, count: 1, byMe: true }];
  message.reactions = nextReactions;
  return ackFor(message, nextReactions);
}

async function sendMessageStub(input: unknown): Promise<SendMessageActionState> {
  const { body, clientRequestId } = input as {
    body: string;
    clientRequestId: string;
  };
  const message = mockMessage({
    id: `local-${clientRequestId}`,
    senderId: you,
    body,
    clientRequestId,
  });
  messages.push(message);
  return { status: "sent", values: {}, message };
}

export default function ChatLiveKitPage() {
  return (
    <div className="flex h-dvh flex-col bg-bg">
      <ChatClient
        chat={chat}
        sendMessageAction={sendMessageStub}
        toggleReactionAction={toggleReactionStub}
      />
    </div>
  );
}
