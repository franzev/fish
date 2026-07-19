import type { ClientChatImage } from "@/lib/services";
import { describe, expect, it } from "vitest";
import { attachmentRuns } from "./attachment-runs";

const image = (id: string): ClientChatImage => ({
  id,
  status: "ready",
  originalName: `${id}.png`,
  displayPath: `${id}.png`,
});

describe("attachmentRuns", () => {
  it("groups adjacent images while preserving file boundaries", () => {
    const file = { ...image("b"), kind: "file" as const };
    expect(attachmentRuns([image("a"), file, image("c")])).toEqual([
      { kind: "images", items: [image("a")] },
      { kind: "file", item: file },
      { kind: "images", items: [image("c")] },
    ]);
  });
});
