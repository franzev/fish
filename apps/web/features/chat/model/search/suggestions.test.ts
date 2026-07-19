import { describe, expect, it } from "vitest";
import {
  criterionFromSuggestion,
  makeCriterion,
  suggestionsForToken,
  suggestionValue,
} from "./index";

const member = { id: "member-1", displayName: "Ada", username: "ada" };
const channel = { id: "channel-1", name: "General", slug: "general", conversationId: "conversation-1" };

describe("search criteria and suggestions", () => {
  it("owns stable criterion ids in one constructor", () => {
    expect(makeCriterion("from", member)).toEqual({ id: "from:member-1", kind: "from", member });
    expect(makeCriterion("in", channel)).toEqual({ id: "in:channel-1", kind: "in", channel });
    expect(makeCriterion("date", { operator: "during", date: "2026-07-19" })).toEqual({
      id: "during:2026-07-19",
      kind: "date",
      operator: "during",
      date: "2026-07-19",
    });
  });

  it("maps suggestions to criteria without component knowledge", () => {
    const suggestion = { kind: "member" as const, member };
    expect(suggestionValue(suggestion)).toBe("ada");
    expect(criterionFromSuggestion("mentions", suggestion)).toEqual(
      makeCriterion("mentions", member)
    );
    expect(criterionFromSuggestion("has", { kind: "content", value: "file" })).toEqual(
      makeCriterion("has", "file")
    );
  });

  it("builds filtered suggestions for each operator family", () => {
    expect(suggestionsForToken({ operator: "from", value: "ad" }, [member], [])).toEqual([
      { kind: "member", member },
    ]);
    expect(suggestionsForToken({ operator: "in", value: "gen" }, [], [channel])).toEqual([
      { kind: "channel", channel },
    ]);
    expect(suggestionsForToken({ operator: "during", value: "" }, [], [], "2026-07-19")).toEqual([
      { kind: "date", value: "2026-07-19" },
    ]);
  });
});
