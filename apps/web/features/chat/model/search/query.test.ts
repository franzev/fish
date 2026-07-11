import { describe, expect, it } from "vitest";
import {
  appendChatSearchOperator,
  criteriaFromQuery,
  parseChatSearchQuery,
  queryFromCriteria,
  reconcileCriteria,
  replaceChatSearchToken,
} from "./query";
import type { ChatFilterCriterion } from "./types";

describe("chat search query", () => {
  it("finds an empty active from token at the caret", () => {
    const parsed = parseChatSearchQuery("project from:");

    expect(parsed.text).toBe("project");
    expect(parsed.activeToken).toMatchObject({ operator: "from", value: "" });
  });

  it("parses multiple tokens and quoted values", () => {
    const parsed = parseChatSearchQuery(
      'project from:yoshi mentions:"sir regan" has:file'
    );

    expect(parsed.text).toBe("project");
    expect(parsed.tokens.map(({ operator, value }) => ({ operator, value }))).toEqual([
      { operator: "from", value: "yoshi" },
      { operator: "mentions", value: "sir regan" },
      { operator: "has", value: "file" },
    ]);
  });

  it("does not treat an operator embedded in a word as a token", () => {
    const parsed = parseChatSearchQuery("platform: notes");

    expect(parsed.tokens).toEqual([]);
    expect(parsed.text).toBe("platform: notes");
  });

  it("replaces an active token and leaves the caret ready for another term", () => {
    const query = "hello from:yo";
    const token = parseChatSearchQuery(query).activeToken;
    expect(token).not.toBeNull();

    expect(replaceChatSearchToken(query, token!, "yoshibro5019")).toEqual({
      value: "hello from: yoshibro5019 ",
      caret: 25,
    });
  });

  it("appends operators without doubled or leading spaces", () => {
    expect(appendChatSearchOperator("", "from").value).toBe("from:");
    expect(appendChatSearchOperator("hello  ", "mentions").value).toBe(
      "hello mentions:"
    );
  });

  it("serializes and reconciles stable selected criteria", () => {
    const criterion: ChatFilterCriterion = {
      id: "criterion-1",
      kind: "from",
      member: {
        id: "member-1",
        displayName: "Yoshibro",
        username: "yoshibro5019",
      },
    };

    const query = queryFromCriteria("hello", [criterion]);
    expect(query).toBe("hello from: yoshibro5019");
    expect(reconcileCriteria(query, [criterion])).toEqual([criterion]);
    expect(reconcileCriteria("hello", [criterion])).toEqual([]);
  });

  it("reconstructs supported criteria from a canonical URL query", () => {
    const member = {
      id: "member-1",
      displayName: "Yoshibro",
      username: "yoshibro5019",
    };
    const channel = {
      id: "channel-1",
      name: "General",
      slug: "general",
      conversationId: "conversation-1",
    };

    expect(
      criteriaFromQuery(
        "hello from:yoshibro5019 in:general has:file pinned:true during:2026-07-11",
        [member],
        [channel]
      )
    ).toEqual([
      { id: "from:member-1", kind: "from", member },
      { id: "in:channel-1", kind: "in", channel },
      { id: "has:file", kind: "has", contentKind: "file" },
      { id: "pinned:true", kind: "pinned", value: true },
      { id: "during:2026-07-11", kind: "date", operator: "during", date: "2026-07-11" },
    ]);
  });
});
