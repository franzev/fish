import { describe, expect, it, vi } from "vitest";
import { fetchReactionsFor, indexAttachments } from "./chat-enrichment";

describe("chat enrichment folds", () => {
  it("loads stable viewer-specific summaries in bounded batches", async () => {
    const messageIds = Array.from({ length: 51 }, (_, index) => `m${index}`);
    const rpc = vi.fn(async (_name: string, input: { p_message_ids: string[] }) => ({
      data: input.p_message_ids.flatMap((messageId) =>
        messageId === "m0"
          ? [
              { message_id: "m0", emoji: "❤️", count: 2, by_me: false },
              { message_id: "m0", emoji: "👍", count: 1, by_me: true },
            ]
          : messageId === "m50"
            ? [{ message_id: "m50", emoji: "🎉", count: 3, by_me: true }]
            : []
      ),
      error: null,
    }));

    const summaries = await fetchReactionsFor({ rpc } as never, messageIds);

    expect(rpc.mock.calls.map(([, input]) => input.p_message_ids.length)).toEqual([50, 1]);
    expect(summaries.get("m0")).toEqual([
      { emoji: "❤️", count: 2, by_me: false },
      { emoji: "👍", count: 1, by_me: true },
    ]);
    expect(summaries.get("m50")).toEqual([
      { emoji: "🎉", count: 3, by_me: true },
    ]);
  });

  it("indexes ordered attachments and resolves both signed paths", () => {
    const indexed = indexAttachments([
      {
        id: "a1",
        message_id: "m1",
        status: "ready",
        kind: "image",
        original_name: "photo.png",
        stored_mime_type: "image/png",
        stored_byte_size: 10,
        width: 20,
        height: 30,
        thumbnail_path: "thumb",
        display_path: "display",
      },
    ], new Map([["thumb", "signed-thumb"], ["display", "signed-display"]]));
    expect(indexed.get("m1")).toEqual([expect.objectContaining({ thumbnail_url: "signed-thumb", display_url: "signed-display" })]);
  });
});
