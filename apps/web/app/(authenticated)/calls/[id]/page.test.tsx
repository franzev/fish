import { render, screen } from "@testing-library/react";
import type { ClientChatData } from "@/lib/services";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { callScreenMock, chatClientMock, getCallChatDataMock } = vi.hoisted(() => ({
  callScreenMock: vi.fn(),
  chatClientMock: vi.fn(),
  getCallChatDataMock: vi.fn(),
}));

vi.mock("@/features/calls", () => ({
  CallScreen: (props: { callId: string; chatSidebar?: React.ReactNode }) => {
    callScreenMock(props);
    return <div data-testid="call-screen">{props.chatSidebar}</div>;
  },
}));

vi.mock("@/features/chat", () => ({
  ChatClient: (props: { chat: ClientChatData; presentation?: string }) => {
    chatClientMock(props);
    return <div>Embedded chat</div>;
  },
}));

vi.mock("@/features/chat/server", () => ({
  backfillMessagesAction: vi.fn(),
  deleteMessageAction: vi.fn(),
  editMessageAction: vi.fn(),
  loadNewestMessagesAction: vi.fn(),
  loadOlderMessagesAction: vi.fn(),
  markReadStateAction: vi.fn(),
  refreshConversationAction: vi.fn(),
  refreshMessagesAction: vi.fn(),
  refreshUnreadSummaryAction: vi.fn(),
  reportGifAction: vi.fn(),
  sendMessageAction: vi.fn(),
  setReactionAction: vi.fn(),
}));

vi.mock("@/features/chat/server/page-data", () => ({
  getCallChatData: getCallChatDataMock,
}));

import CallPage from "./page";

const chat: ClientChatData = {
  conversationId: "conversation-1",
  kind: "direct",
  currentUserId: "client-1",
  currentUserRole: "client",
  currentUserDisplayName: "Franz",
  participant: {
    id: "coach-1",
    displayName: "Gwyn",
    role: "coach",
  },
  messages: [],
};

describe("CallPage", () => {
  beforeEach(() => {
    callScreenMock.mockReset();
    chatClientMock.mockReset();
    getCallChatDataMock.mockReset();
  });

  it("composes the existing direct conversation into the call screen", async () => {
    getCallChatDataMock.mockResolvedValue(chat);

    render(await CallPage({ params: Promise.resolve({ id: "call-1" }) }));

    expect(getCallChatDataMock).toHaveBeenCalledWith("call-1");
    expect(screen.getByText("Embedded chat")).toBeInTheDocument();
    expect(chatClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ chat, presentation: "embedded" })
    );
    expect(callScreenMock).toHaveBeenCalledWith(
      expect.objectContaining({ callId: "call-1" })
    );
  });

  it("keeps the call surface unchanged when no conversation exists", async () => {
    getCallChatDataMock.mockResolvedValue(null);

    render(await CallPage({ params: Promise.resolve({ id: "call-2" }) }));

    expect(screen.queryByText("Embedded chat")).toBeNull();
    expect(chatClientMock).not.toHaveBeenCalled();
    expect(callScreenMock).toHaveBeenCalledWith({
      callId: "call-2",
      chatSidebar: undefined,
    });
  });
});
