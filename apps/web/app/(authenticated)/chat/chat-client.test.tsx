import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientChatData } from "@/lib/services";
import { ChatClient } from "./chat-client";

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
    },
  ],
};

describe("ChatClient", () => {
  it("renders the direct assigned conversation without an inbox", () => {
    render(<ChatClient chat={chat} sendMessageAction={vi.fn()} />);

    expect(screen.getByText("Coach Dana")).toBeInTheDocument();
    expect(screen.getByText("How did practice feel today?")).toBeInTheDocument();
    expect(screen.queryByLabelText(/search conversations/i)).toBeNull();
  });

  it("optimistically sends and clears the draft after success", async () => {
    const sendMessageAction = vi.fn().mockResolvedValueOnce({
      status: "sent",
      values: {},
      message: {
        id: "message-2",
        conversationId: chat.conversationId,
        senderId: "client-1",
        senderRole: "client",
        body: "It felt steady.",
        clientRequestId: "local-request",
        createdAt: "2026-07-05T00:01:00.000Z",
      },
    });

    render(<ChatClient chat={chat} sendMessageAction={sendMessageAction} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "It felt steady." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("It felt steady.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Sent")).toBeInTheDocument());
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(sendMessageAction).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: chat.conversationId,
        body: "It felt steady.",
      })
    );
  });

  it("preserves the draft and offers retry when send fails", async () => {
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
    expect(screen.getByLabelText("Message")).toHaveValue("Please keep this draft.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
