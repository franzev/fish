import { describe, expect, it } from "vitest";
import { createSearchRequest } from "./search-request";
import type { ChatFilterCriterion } from "./types";

const member = {
  id: "member-1",
  displayName: "Ada Lovelace",
  username: "ada",
};
const channel = {
  id: "channel-1",
  name: "General",
  slug: "general",
  conversationId: "conversation-1",
};

describe("createSearchRequest", () => {
  it("maps every criterion family and uses a stable paging contract", () => {
    const criteria: ChatFilterCriterion[] = [
      { id: "from:member-1", kind: "from", member },
      { id: "mentions:member-1", kind: "mentions", member },
      { id: "in:channel-1", kind: "in", channel },
      { id: "has:file", kind: "has", contentKind: "file" },
      { id: "author:coach", kind: "author", authorType: "coach" },
      { id: "pinned:true", kind: "pinned", value: true },
      { id: "after:2026-07-18", kind: "date", operator: "after", date: "2026-07-18" },
    ];

    expect(
      createSearchRequest("conversation-1", "from:ada practice", criteria, 3, "asc", {
        pageSize: 10,
        timeZone: "Asia/Manila",
      })
    ).toEqual({
      conversationId: "conversation-1",
      text: "practice",
      senderIds: ["member-1"],
      mentionedUserIds: ["member-1"],
      channelIds: ["channel-1"],
      contentKinds: ["file"],
      authorTypes: ["coach"],
      pinned: true,
      dates: [{ operator: "after", date: "2026-07-18", timeZone: "Asia/Manila" }],
      cursor: null,
      offset: 20,
      sortDirection: "asc",
      limit: 10,
    });
  });

  it("uses the first pinned criterion and normalizes invalid pages", () => {
    expect(
      createSearchRequest(
        "conversation-1",
        "hello",
        [
          { id: "pinned:false", kind: "pinned", value: false },
          { id: "pinned:true", kind: "pinned", value: true },
        ],
        0,
        "desc",
        { pageSize: 25, timeZone: "UTC" }
      )
    ).toMatchObject({ pinned: false, offset: 0, limit: 25 });
  });
});
