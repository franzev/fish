import { describe, expect, it } from "vitest";
import { createChatSearchUrl, readChatSearchUrlState } from "./url-state";

describe("chat search URL state", () => {
  it("reads a committed query, page, and sort direction", () => {
    expect(readChatSearchUrlState("?search=phone+calls&page=3&sort=asc")).toEqual({
      query: "phone calls",
      page: 3,
      sortDirection: "asc",
    });
  });

  it("rejects empty searches and safely normalizes malformed values", () => {
    expect(readChatSearchUrlState("?page=4")).toBeNull();
    expect(readChatSearchUrlState("?search=hello&page=-2&sort=random")).toEqual({
      query: "hello",
      page: 1,
      sortDirection: "desc",
    });
  });

  it("preserves unrelated parameters and omits default search values", () => {
    expect(
      createChatSearchUrl("https://fish.test/channels/general?panel=members#chat", {
        query: "phone calls",
        page: 1,
        sortDirection: "desc",
      })
    ).toBe("/channels/general?panel=members&search=phone+calls#chat");
  });

  it("clears only search-owned parameters", () => {
    expect(
      createChatSearchUrl(
        "https://fish.test/channels/general?panel=members&search=hello&page=2&sort=asc",
        null
      )
    ).toBe("/channels/general?panel=members");
  });
});
