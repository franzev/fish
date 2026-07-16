import fixtures from "@fish/core/chat-state/fixtures/chat-media-merge-vectors.json";
import { mergeChatMessage } from "@fish/core/chat-state";
import type { ChatMessageState } from "@fish/core/chat-state";
import { describe, expect, it } from "vitest";

describe("chat media merge fixtures", () => {
  it.each(fixtures)("replays $name", (fixture) => {
    const merged = mergeChatMessage(
      [fixture.existing as ChatMessageState],
      fixture.incoming as ChatMessageState,
    )[0];

    expect(merged.gif?.providerId ?? null).toBe(fixture.expectedGifProviderId);
    expect(merged.stickerId ?? null).toBe(fixture.expectedStickerId);
  });
});
