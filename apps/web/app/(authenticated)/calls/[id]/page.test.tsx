import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    redirectMock(href);
    throw new Error("NEXT_REDIRECT");
  },
}));

import CallPage from "./page";

describe("CallPage compatibility route", () => {
  it("returns legacy call links to the authenticated home surface", async () => {
    await expect(
      CallPage({ params: Promise.resolve({ id: "call-1" }) })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/home");
  });
});
