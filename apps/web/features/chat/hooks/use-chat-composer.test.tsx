import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientChatData, ClientChatGif } from "@/lib/services";
import { resetChatStoreForTests } from "@/features/chat/model/store";
import { useChatComposer } from "./use-chat-composer";
import type { LocalMessage } from "./use-chat-messages";

const conversationA: ClientChatData = {
  conversationId: "11111111-1111-4111-8111-111111111111",
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

const gifA: ClientChatGif = {
  provider: "klipy",
  providerId: "gif-a",
  title: "GIF A",
  description: "The first GIF",
  sourceUrl: "https://klipy.com/gifs/gif-a",
  posterUrl: "https://static.klipy.com/gif-a.jpg",
  previewUrl: "https://static.klipy.com/gif-a-preview.mp4",
  mediaUrl: "https://static.klipy.com/gif-a.mp4",
  width: 480,
  height: 270,
};

const gifB: ClientChatGif = {
  ...gifA,
  providerId: "gif-b",
  title: "GIF B",
  description: "The newer GIF",
  sourceUrl: "https://klipy.com/gifs/gif-b",
  posterUrl: "https://static.klipy.com/gif-b.jpg",
  previewUrl: "https://static.klipy.com/gif-b-preview.mp4",
  mediaUrl: "https://static.klipy.com/gif-b.mp4",
};

const ownMessage: LocalMessage = {
  id: "message-1",
  conversationId: conversationA.conversationId,
  senderId: conversationA.currentUserId,
  senderRole: conversationA.currentUserRole,
  senderDisplayName: conversationA.currentUserDisplayName,
  body: "Original message",
  clientRequestId: "seed-1",
  createdAt: "2026-07-14T00:00:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  reactions: [],
  localStatus: "sent",
};

function options(
  chat: ClientChatData,
  sendMessageAction: (input: unknown) => Promise<{
    status: "sent" | "notice";
    values: unknown;
    notice?: string;
  }>
) {
  return {
    chat,
    messages: [],
    sendMessageAction,
    sendLocalTyping: vi.fn(),
    stopLocalTyping: vi.fn(),
    scheduleLocalTypingStop: vi.fn(),
    pendingImages: [],
    clearPendingImages: vi.fn(),
  };
}

describe("useChatComposer GIF selection", () => {
  beforeEach(() => {
    resetChatStoreForTests();
  });

  it("preserves a newer GIF when an earlier send fails late", async () => {
    type NoticeResult = {
      status: "notice";
      values: unknown;
      notice: string;
    };
    let resolveSend: (value: NoticeResult) => void = () => undefined;
    const sendMessageAction = vi.fn(
      () => new Promise<NoticeResult>((resolve) => {
        resolveSend = resolve;
      })
    );
    const { result } = renderHook(() =>
      useChatComposer(options(conversationA, sendMessageAction))
    );

    act(() => result.current.selectGif(gifA, "first"));
    let pendingSend: Promise<void> = Promise.resolve();
    act(() => {
      pendingSend = result.current.handleSend();
    });
    await waitFor(() => expect(sendMessageAction).toHaveBeenCalledOnce());
    expect(result.current.selectedGif).toBeNull();

    act(() => result.current.selectGif(gifB, "newer"));
    await act(async () => {
      resolveSend({
        status: "notice",
        values: {},
        notice: "That did not send yet. Keep this open and try again.",
      });
      await pendingSend;
    });

    expect(result.current.selectedGif).toEqual(gifB);
  });

  it("clears a selected GIF when the mounted composer changes conversations", () => {
    const sendMessageAction = vi.fn(async () => ({
      status: "notice" as const,
      values: {},
    }));
    const { result, rerender } = renderHook(
      ({ chat }) => useChatComposer(options(chat, sendMessageAction)),
      { initialProps: { chat: conversationA } }
    );

    act(() => result.current.selectGif(gifA, "first"));
    expect(result.current.selectedGif).toEqual(gifA);

    rerender({
      chat: {
        ...conversationA,
        conversationId: "22222222-2222-4222-8222-222222222222",
      },
    });

    expect(result.current.selectedGif).toBeNull();
  });
});

describe("useChatComposer sticker selection", () => {
  beforeEach(() => {
    resetChatStoreForTests();
  });

  it("enables and sends a sticker id without an attachment", async () => {
    const sendMessageAction = vi.fn(async () => ({
      status: "notice" as const,
      values: {},
    }));
    const { result } = renderHook(() =>
      useChatComposer(options(conversationA, sendMessageAction))
    );

    act(() => result.current.selectSticker("aquatic-hello-otter"));
    expect(result.current.canSend).toBe(true);
    await act(async () => result.current.handleSend());

    expect(sendMessageAction).toHaveBeenCalledWith(expect.objectContaining({
      body: "",
      attachmentIds: [],
      stickerId: "aquatic-hello-otter",
    }));
  });
});

describe("useChatComposer inline editing", () => {
  beforeEach(() => {
    resetChatStoreForTests();
  });

  it("keeps the unsent composer draft when editing is cancelled", () => {
    const sendMessageAction = vi.fn(async () => ({
      status: "notice" as const,
      values: {},
    }));
    const { result } = renderHook(() =>
      useChatComposer({
        ...options(conversationA, sendMessageAction),
        messages: [ownMessage],
      })
    );

    act(() => result.current.handleDraftChange("An unsent draft"));
    act(() => result.current.startEditingMessage(ownMessage));

    expect(result.current.draft).toBe("An unsent draft");
    expect(result.current.editDraft).toBe("Original message");
    expect(result.current.editingMessage?.id).toBe(ownMessage.id);

    act(() => result.current.cancelEdit());
    expect(result.current.draft).toBe("An unsent draft");
    expect(result.current.editingMessage).toBeNull();
  });

  it("retains inline changes and a local notice when saving fails", async () => {
    const sendMessageAction = vi.fn(async () => ({
      status: "notice" as const,
      values: {},
    }));
    const editMessageAction = vi.fn(async () => ({
      status: "notice" as const,
      values: {},
      notice: "That didn’t save yet. Your changes are still here. Try again.",
    }));
    const { result } = renderHook(() =>
      useChatComposer({
        ...options(conversationA, sendMessageAction),
        messages: [ownMessage],
        editMessageAction,
      })
    );

    act(() => result.current.startEditingMessage(ownMessage));
    act(() => result.current.handleEditDraftChange("A careful revision"));
    await act(async () => result.current.handleSaveEdit());

    expect(editMessageAction).toHaveBeenCalledWith({
      messageId: ownMessage.id,
      body: "A careful revision",
    });
    expect(result.current.editDraft).toBe("A careful revision");
    expect(result.current.editNotice).toBe(
      "That didn’t save yet. Your changes are still here. Try again."
    );
    expect(result.current.isSavingEdit).toBe(false);
  });

  it("returns deletion failures to the message confirmation surface", async () => {
    const sendMessageAction = vi.fn(async () => ({
      status: "notice" as const,
      values: {},
    }));
    const deleteMessageAction = vi.fn(async () => ({
      status: "notice" as const,
      values: {},
      notice: "That didn’t delete yet. Keep this open and try again.",
    }));
    const { result } = renderHook(() =>
      useChatComposer({
        ...options(conversationA, sendMessageAction),
        messages: [ownMessage],
        deleteMessageAction,
      })
    );

    let outcome: Awaited<ReturnType<typeof result.current.handleDeleteMessage>>;
    await act(async () => {
      outcome = await result.current.handleDeleteMessage(ownMessage);
    });

    expect(outcome!).toEqual({
      ok: false,
      notice: "That didn’t delete yet. Keep this open and try again.",
    });
  });
});
