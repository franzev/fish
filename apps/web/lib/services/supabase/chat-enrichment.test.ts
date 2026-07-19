import { describe, expect, it } from "vitest";
import { aggregateReactions, indexAttachments } from "./chat-enrichment";

describe("chat enrichment folds", () => {
  it("aggregates reaction counts and current-user state without query assumptions", () => {
    expect(aggregateReactions([
      { message_id: "m1", emoji: "👍", user_id: "u1" },
      { message_id: "m1", emoji: "👍", user_id: "u2" },
      { message_id: "m1", emoji: "❤️", user_id: "u3" },
    ], "u2").get("m1")).toEqual([
      { emoji: "👍", count: 2, by_me: true },
      { emoji: "❤️", count: 1, by_me: false },
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
