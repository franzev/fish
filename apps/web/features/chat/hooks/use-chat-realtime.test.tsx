import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chat } from "../components/chat-client/chat-client.fixtures";
import { resetChatStoreForTests } from "../model/store";
import { useChatRealtime } from "./use-chat-realtime";

const realtime = vi.hoisted(() => ({
  messages: [] as Array<(...args: unknown[]) => void>,
  reads: [] as Array<(...args: unknown[]) => void>,
  reactions: [] as Array<(...args: unknown[]) => void>,
  typing: [] as Array<(...args: unknown[]) => void>,
}));

vi.mock("../model/realtime", () => ({
  subscribeToConversationMessages: vi.fn((...args: unknown[]) => {
    realtime.messages.push(
      args[1] as (...args: unknown[]) => void,
      args[2] as (...args: unknown[]) => void,
      args[3] as (...args: unknown[]) => void
    );
    return vi.fn();
  }),
  subscribeToConversationReadStates: vi.fn((...args: unknown[]) => {
    realtime.reads.push(
      args[1] as (...args: unknown[]) => void,
      args[2] as (...args: unknown[]) => void
    );
    return vi.fn();
  }),
  subscribeToConversationReactionChanges: vi.fn((...args: unknown[]) => {
    realtime.reactions.push(
      args[1] as (...args: unknown[]) => void,
      args[2] as (...args: unknown[]) => void
    );
    return vi.fn();
  }),
  subscribeToConversationTyping: vi.fn((...args: unknown[]) => {
    realtime.typing.push(args[2] as (...args: unknown[]) => void);
    return { sendTyping: vi.fn(), unsubscribe: vi.fn() };
  }),
}));

function Harness({
  applyGapBackfill,
}: {
  applyGapBackfill: () => Promise<void>;
}) {
  const state = useChatRealtime({
    chat,
    mergeReadState: () => undefined,
    refreshMessages: async () => undefined,
    refreshConversation: async () => undefined,
    applyGapBackfill,
  });
  return <span data-testid="typing">{String(state.participantTyping)}</span>;
}

beforeEach(() => {
  resetChatStoreForTests();
  realtime.messages.length = 0;
  realtime.reads.length = 0;
  realtime.reactions.length = 0;
  realtime.typing.length = 0;
});

describe("useChatRealtime", () => {
  it("skips each initial subscription callback and coalesces reconnect backfills", async () => {
    let resolveBackfill!: () => void;
    const backfill = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveBackfill = resolve;
        })
    );
    render(<Harness applyGapBackfill={backfill} />);

    await waitFor(() => expect(realtime.messages).toHaveLength(3));

    await act(async () => {
      realtime.messages[1]?.("SUBSCRIBED");
      realtime.reads[1]?.("SUBSCRIBED");
      realtime.reactions[1]?.("SUBSCRIBED");
    });
    expect(backfill).not.toHaveBeenCalled();

    await act(async () => {
      realtime.reads[1]?.("SUBSCRIBED");
      realtime.messages[1]?.("SUBSCRIBED");
    });
    expect(backfill).toHaveBeenCalledTimes(1);

    await act(async () => {
      realtime.reactions[1]?.("SUBSCRIBED");
    });
    expect(backfill).toHaveBeenCalledTimes(1);

    resolveBackfill();
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      realtime.reactions[1]?.("SUBSCRIBED");
    });
    expect(backfill).toHaveBeenCalledTimes(2);
  });
});
