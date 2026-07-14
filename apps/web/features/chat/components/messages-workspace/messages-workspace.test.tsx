import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ClientChatData,
  ClientDirectConversationPreview,
} from "@/lib/services";
import { resetChatStoreForTests } from "@/features/chat/model/store";
import { MessagesWorkspace } from "./messages-workspace";

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
      senderId: "client-1",
      senderRole: "client",
      body: "I will send my notes this afternoon.",
      clientRequestId: "seed-1",
      createdAt: "2026-07-14T08:33:00.000Z",
    },
  ],
};
const conversations: ClientDirectConversationPreview[] = [
  {
    conversationId: chat.conversationId,
    participant: chat.participant,
    latestMessage: {
      senderId: "client-1",
      text: "I will send my notes this afternoon.",
      createdAt: "2026-07-14T08:33:00.000Z",
    },
    unreadCount: 0,
  },
  {
    conversationId: "22222222-2222-4222-8222-222222222222",
    participant: {
      id: "friend-1",
      displayName: "Sam Okafor",
      role: "client",
    },
    latestMessage: {
      senderId: "friend-1",
      text: "Want to practise tomorrow?",
      createdAt: "2026-07-15T08:00:00.000Z",
    },
    unreadCount: 2,
  },
];

describe("MessagesWorkspace", () => {
  beforeEach(() => {
    resetChatStoreForTests();
  });

  it("frames the active direct conversation with calm desktop context", () => {
    render(
      <MessagesWorkspace chat={chat} conversations={conversations}>
        <div>Active conversation</div>
      </MessagesWorkspace>
    );

    expect(screen.getByRole("heading", { name: "Messages" }).parentElement).toHaveClass(
      "h-chat-header"
    );
    expect(screen.getByRole("link", { name: /Coach Dana/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /Sam Okafor/ })).toHaveAttribute(
      "href",
      "/messages/22222222-2222-4222-8222-222222222222"
    );
    expect(screen.getByText("You: I will send my notes this afternoon.")).toBeInTheDocument();
    expect(screen.getByText("Active conversation")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Details" }).parentElement).toHaveClass(
      "h-chat-header"
    );
    expect(screen.getByText("Only you and your coach can take part.")).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(screen.queryByText(/rating/i)).not.toBeInTheDocument();
  });

  it("describes a client-to-client direct conversation as friendship", () => {
    render(
      <MessagesWorkspace
        chat={{
          ...chat,
          participant: {
            id: "friend-1",
            displayName: "Sam Okafor",
            role: "client",
          },
        }}
        conversations={conversations}
      >
        <div>Active conversation</div>
      </MessagesWorkspace>
    );

    expect(screen.getByText("Your friend")).toBeInTheDocument();
    expect(screen.getByText("You’re friends on FISH.")).toBeInTheDocument();
    expect(screen.getByText("Only you and your friend can take part.")).toBeInTheDocument();
    expect(screen.queryByText("One-to-one coaching")).not.toBeInTheDocument();
    expect(screen.queryByText("English coaching")).not.toBeInTheDocument();
  });

  it("describes a coach's direct conversation as their assigned client", () => {
    render(
      <MessagesWorkspace
        chat={{
          ...chat,
          currentUserId: "coach-1",
          currentUserRole: "coach",
          participant: {
            id: "client-1",
            displayName: "Alex Rivera",
            role: "client",
          },
        }}
      >
        <div>Active conversation</div>
      </MessagesWorkspace>
    );

    expect(screen.getByText("Your client")).toBeInTheDocument();
    expect(screen.getByText("Your assigned client")).toBeInTheDocument();
    expect(screen.getByText("Only you and your client can take part.")).toBeInTheDocument();
    expect(screen.queryByText("Your assigned coach")).not.toBeInTheDocument();
  });
});
