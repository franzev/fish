import { describe, expect, it } from "vitest";
import {
  EMOJI_ONLY_RE,
  parseList,
  sanitizeHref,
  tokenize,
} from "./message-body-parser";

describe("message body parser", () => {
  it("keeps an unclosed fence as one code block", () => {
    expect(tokenize("```ts\nconst answer = 42;")).toEqual([
      { type: "code", lang: "ts", code: "const answer = 42;" },
    ]);
  });

  it("parses indented nested list items", () => {
    expect(tokenize("- one\n  - two")[0]).toEqual({
      type: "list",
      ordered: false,
      items: [{ text: "one", children: { type: "list", ordered: false, items: [{ text: "two" }] } }],
    });
    expect(parseList(["1. one", "   1. two"], 0, 0).list.ordered).toBe(true);
  });

  it("recognizes emoji-only messages without treating ordinary digits as emoji", () => {
    expect(EMOJI_ONLY_RE.test(" 👩🏽‍💻 ")).toBe(true);
    expect(EMOJI_ONLY_RE.test("🇵🇭")).toBe(true);
    expect(EMOJI_ONLY_RE.test("1")).toBe(false);
    expect(EMOJI_ONLY_RE.test("😀 😀")).toBe(false);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"])(
    "neutralizes unsafe href %s",
    (href) => expect(sanitizeHref(href)).toBeNull()
  );

  it("keeps safe href schemes and balanced URL parentheses", () => {
    expect(sanitizeHref("https://example.com/Article_(test)")).toBe(
      "https://example.com/Article_(test)"
    );
    expect(sanitizeHref("mailto:help@example.com")).toBe("mailto:help@example.com");
  });
});
